import { parseHeaders, sanitizeHeaderValue, isSameOrigin } from "./utils";

export default function xhrAdapter(config: any) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    xhr.open(config.method.toUpperCase(), config.url, true);

    xhr.timeout = config.timeout || 0;

    // Set headers, sanitizing values to prevent header injection
    Object.keys(config.headers || {}).forEach((key) => {
      xhr.setRequestHeader(key, sanitizeHeaderValue(config.headers[key]));
    });

    // XSRF protection: only inject token for same-origin requests (CVE-2023-45857 fix)
    if (config.xsrfCookieName && config.xsrfHeaderName) {
      const currentOrigin = typeof window !== "undefined" ? window.location.href : "";
      if (!currentOrigin || isSameOrigin(config.url, currentOrigin)) {
        const xsrfValue = getCookie(config.xsrfCookieName);
        if (xsrfValue) {
          xhr.setRequestHeader(config.xsrfHeaderName, xsrfValue);
        }
      }
    }

    // AbortSignal support
    if (config.signal) {
      const onAbort = () => {
        xhr.abort();
        const error: any = new Error("Request aborted");
        error.config = config;
        error.code = "ERR_CANCELED";
        error.request = xhr;
        reject(error);
      };
      if (config.signal.aborted) {
        onAbort();
        return;
      }
      config.signal.addEventListener("abort", onAbort, { once: true });
    }

    xhr.onreadystatechange = () => {
      if (xhr.readyState !== 4) return;

      const response = {
        data: xhr.responseText,
        status: xhr.status === 1223 ? 204 : xhr.status,
        statusText: xhr.statusText,
        headers: parseHeaders(xhr.getAllResponseHeaders()),
        config,
        request: xhr,
      };

      if (response.status >= 200 && response.status < 300) {
        resolve(response);
      } else {
        const error: any = new Error(
          `Request failed with status code ${response.status}`
        );
        error.config = config;
        error.request = xhr;
        error.response = response;
        reject(error);
      }
    };

    xhr.onerror = () => {
      const error: any = new Error("Network Error");
      error.config = config;
      error.request = xhr;
      reject(error);
    };

    xhr.ontimeout = () => {
      const error: any = new Error(`Timeout of ${config.timeout}ms exceeded`);
      error.config = config;
      error.code = "ECONNABORTED";
      error.request = xhr;
      reject(error);
    };

    xhr.send(config.data || null);
  });
}

function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(
    new RegExp("(?:^|;\\s*)" + encodeURIComponent(name) + "=([^;]*)")
  );
  return match ? decodeURIComponent(match[1]) : null;
}
