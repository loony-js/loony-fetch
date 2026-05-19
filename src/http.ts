import http from "http";
import https from "https";
import { validateURL, sanitizeHeaderValue } from "./utils";

const MAX_REDIRECTS = 5;

export default function httpAdapter(config: any): Promise<any> {
  return followRedirects(config, 0);
}

function followRedirects(config: any, redirectCount: number): Promise<any> {
  return new Promise((resolve, reject) => {
    let parsedUrl: URL;
    try {
      parsedUrl = validateURL(config.url);
    } catch (err) {
      reject(err);
      return;
    }

    const isHttps = parsedUrl.protocol === "https:";
    const lib = isHttps ? https : http;

    // Sanitize all header values to prevent HTTP header injection
    const safeHeaders: Record<string, string> = {};
    Object.keys(config.headers || {}).forEach((key) => {
      safeHeaders[sanitizeHeaderValue(key)] = sanitizeHeaderValue(
        config.headers[key]
      );
    });

    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (isHttps ? 443 : 80),
      path: parsedUrl.pathname + parsedUrl.search,
      method: (config.method || "get").toUpperCase(),
      headers: safeHeaders,
    };

    const maxContentLength: number =
      typeof config.maxContentLength === "number" ? config.maxContentLength : -1;
    let receivedBytes = 0;
    let finished = false;

    const req = lib.request(options, (res) => {
      // Handle redirects (3xx)
      if (
        res.statusCode !== undefined &&
        res.statusCode >= 300 &&
        res.statusCode < 400 &&
        res.headers.location
      ) {
        res.resume(); // consume and discard body
        if (redirectCount >= MAX_REDIRECTS) {
          const error: any = new Error(
            `Maximum redirects (${MAX_REDIRECTS}) exceeded`
          );
          error.config = config;
          error.code = "ERR_TOO_MANY_REDIRECTS";
          reject(error);
          return;
        }
        let redirectUrl: string;
        try {
          // location may be relative
          redirectUrl = new URL(res.headers.location, config.url).toString();
          validateURL(redirectUrl); // ensure redirect target is also http/https
        } catch (err) {
          reject(err);
          return;
        }
        const redirectConfig = { ...config, url: redirectUrl };
        // Downgrade to GET on 301/302/303 per RFC 7231
        if (
          res.statusCode === 301 ||
          res.statusCode === 302 ||
          res.statusCode === 303
        ) {
          redirectConfig.method = "get";
          delete redirectConfig.data;
        }
        followRedirects(redirectConfig, redirectCount + 1).then(resolve, reject);
        return;
      }

      const chunks: Buffer[] = [];

      res.on("data", (chunk: Buffer) => {
        receivedBytes += chunk.length;
        if (maxContentLength !== -1 && receivedBytes > maxContentLength) {
          if (!finished) {
            finished = true;
            req.destroy();
            const error: any = new Error(
              `Response size exceeded maxContentLength (${maxContentLength} bytes)`
            );
            error.config = config;
            error.code = "ERR_CONTENT_LENGTH_EXCEEDED";
            reject(error);
          }
          return;
        }
        chunks.push(chunk);
      });

      res.on("end", () => {
        if (finished) return;
        finished = true;
        const data = Buffer.concat(chunks).toString("utf8");

        const response: any = {
          data,
          status: res.statusCode,
          statusText: res.statusMessage,
          headers: res.headers,
          config,
          request: req,
        };

        if (response.status >= 200 && response.status < 300) {
          resolve(response);
        } else {
          const error: any = new Error(
            `Request failed with status code ${response.status}`
          );
          error.config = config;
          error.request = req;
          error.response = response;
          reject(error);
        }
      });

      res.on("error", (err: Error) => {
        if (!finished) {
          finished = true;
          const error: any = new Error(err.message);
          error.config = config;
          error.request = req;
          reject(error);
        }
      });
    });

    req.on("error", (err: Error) => {
      if (!finished) {
        finished = true;
        const error: any = new Error(err.message);
        error.config = config;
        error.request = req;
        reject(error);
      }
    });

    if (config.timeout) {
      req.setTimeout(config.timeout, () => {
        if (!finished) {
          finished = true;
          req.destroy();
          const error: any = new Error(`Timeout of ${config.timeout}ms exceeded`);
          error.config = config;
          error.code = "ECONNABORTED";
          error.request = req;
          reject(error);
        }
      });
    }

    // AbortSignal support
    if (config.signal) {
      const onAbort = () => {
        if (!finished) {
          finished = true;
          req.destroy();
          const error: any = new Error("Request aborted");
          error.config = config;
          error.code = "ERR_CANCELED";
          error.request = req;
          reject(error);
        }
      };
      if (config.signal.aborted) {
        onAbort();
        return;
      }
      config.signal.addEventListener("abort", onAbort, { once: true });
    }

    if (config.data) {
      req.write(config.data);
    }

    req.end();
  });
}
