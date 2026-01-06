// mini-axios/http.js
import { URL } from "url";
import http from "http";
import https from "https";
import { isObject } from "./utils.js";

export default function httpAdapter(config: any) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(config.url);
    const isHttps = parsedUrl.protocol === "https:";
    const lib = isHttps ? https : http;

    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (isHttps ? 443 : 80),
      path: parsedUrl.pathname + parsedUrl.search,
      method: config.method,
      headers: config.headers,
    };

    const req = lib.request(options, (res) => {
      let data = "";

      res.on("data", (chunk) => (data += chunk));

      res.on("end", () => {
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
          // Axios-like error rejection
          const error: any = new Error(
            `Request failed with status code ${response.status}`
          );
          error.config = config;
          error.request = req;
          error.response = response;
          reject(error);
        }
      });
    });

    req.on("error", (err) => {
      const error: any = new Error(err.message);
      error.config = config;
      error.request = req;
      reject(error);
    });

    // Node Timeout
    if (config.timeout) {
      req.setTimeout(config.timeout, () => {
        req.destroy();
        const error: any = new Error(`Timeout of ${config.timeout}ms exceeded`);
        error.config = config;
        error.code = "ECONNABORTED";
        error.request = req;
        reject(error);
      });
    }

    // Write body data for POST/PUT/PATCH
    if (config.data) {
      req.write(config.data);
    }

    req.end();
  });
}
