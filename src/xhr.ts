// mini-axios/xhr.js
import { parseHeaders } from "./utils"; // Assuming parseHeaders is added to utils

export default function xhrAdapter(config: any) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    // 1. URL and Method
    xhr.open(config.method.toUpperCase(), config.url, true);

    // 2. Timeout
    xhr.timeout = config.timeout || 0;

    // 3. Headers
    Object.keys(config.headers || {}).forEach((key) => {
      xhr.setRequestHeader(key, config.headers[key]);
    });

    // 4. State Change Listener
    xhr.onreadystatechange = () => {
      if (xhr.readyState !== 4) return;

      // Clear timeout handler if it was set by the adapter (not necessary for native XHR timeout)

      const response = {
        data: xhr.responseText,
        status: xhr.status === 1223 ? 204 : xhr.status, // IE fix for 204
        statusText: xhr.statusText,
        headers: parseHeaders(xhr.getAllResponseHeaders()),
        config,
        request: xhr,
      };

      if (response.status >= 200 && response.status < 300) {
        resolve(response);
      } else {
        // Axios-like error rejection: reject with the response object
        const error: any = new Error(
          `Request failed with status code ${response.status}`
        );
        error.config = config;
        error.request = xhr;
        error.response = response;
        reject(error);
      }
    };

    // 5. Error Handlers
    xhr.onerror = () => {
      const error: any = new Error("Network Error");
      error.config = config;
      error.request = xhr;
      reject(error);
    };

    xhr.ontimeout = () => {
      const error: any = new Error(`Timeout of ${config.timeout}ms exceeded`);
      error.config = config;
      error.code = "ECONNABORTED"; // Axios code for timeout
      error.request = xhr;
      reject(error);
    };

    // 6. Send Request
    xhr.send(config.data || null);
  });
}
