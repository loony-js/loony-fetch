// mini-axios/axios.js
import xhrAdapter from "./xhr";
import httpAdapter from "./http";
import { merge, buildURL } from "./utils";

// Simple check to determine the execution environment
const isBrowser =
  typeof window !== "undefined" && typeof XMLHttpRequest !== "undefined";

/**
 * Manages the interceptor handlers (onFulfilled, onRejected).
 */
class InterceptorManager {
  handlers: Array<{ onFulfilled: Function; onRejected: Function }>;

  constructor() {
    this.handlers = [];
  }

  use(onFulfilled: Function, onRejected: Function) {
    this.handlers.push({ onFulfilled, onRejected });
    // Optional: return index to allow ejecting, but keep it simple for now
  }
}

/**
 * The core Axios class responsible for config, interceptors, and request dispatch.
 */
export default class Fetch {
  defaults: any;
  interceptors: {
    request: InterceptorManager;
    response: InterceptorManager;
  };

  constructor(defaultConfig = {}) {
    this.defaults = defaultConfig;
    this.interceptors = {
      request: new InterceptorManager(),
      response: new InterceptorManager(),
    };
  }

  /**
   * Main request method, processes config and runs the interceptor chain.
   */
  request(config: any) {
    // 1. Merge default config with runtime config
    config = merge(this.defaults, config);
    config.method = (config.method || "get").toLowerCase();

    // 2. Build final URL (baseURL + url + params)
    const finalUrl = config.baseURL ? config.baseURL + config.url : config.url;

    config.url = buildURL(finalUrl, config.params);

    // 3. Automatic JSON request body handling
    if (
      typeof config.data === "object" &&
      config.method !== "get" &&
      config.method !== "head"
    ) {
      config.headers = config.headers || {};
      // Only set Content-Type if user hasn't explicitly set it
      if (!config.headers["Content-Type"] && !config.headers["content-type"]) {
        config.headers["Content-Type"] = "application/json";
      }
      // Stringify the data
      config.data = JSON.stringify(config.data);
    }

    // 4. Build the Interceptor Promise Chain
    // Arrange as pairs: [onFulfilled, onRejected, ...] where the
    // dispatcher sits in the middle as a fulfilled handler followed
    // by an undefined rejection handler. Do NOT reverse the whole
    // array — that caused the dispatcher to become a rejection
    // handler, returning the original config instead of sending
    // the request.
    let chain: any = [
      // Request interceptors (executed in reverse order, LIFO)
      ...this.interceptors.request.handlers
        .map((i) => [i.onFulfilled, i.onRejected])
        .flat()
        .reverse(),

      // Dispatcher (The actual request execution)
      this.dispatchRequest.bind(this),
      undefined,

      // Response interceptors (executed in standard order, FIFO)
      ...this.interceptors.response.handlers
        .map((i) => [i.onFulfilled, i.onRejected])
        .flat(),
    ];

    let promise = Promise.resolve(config);

    // Run the chain
    while (chain.length) {
      // .then(onFulfilled, onRejected)
      promise = promise.then(chain.shift(), chain.shift());
    }

    return promise;
  }

  /**
   * The actual function that executes the request using the appropriate adapter.
   */
  dispatchRequest(config: any) {
    const adapter = isBrowser ? xhrAdapter : httpAdapter;

    return adapter(config).then((res: any) => {
      // Automatic JSON response parsing
      if (typeof res.data === "string" && res.data.length > 0) {
        try {
          // Check for 'application/json' header (case-insensitive)
          const contentType =
            res.headers["content-type"] || res.headers["Content-Type"] || "";
          if (contentType.includes("application/json")) {
            res.data = JSON.parse(res.data);
          }
        } catch (e: any) {
          // Log parsing error but still return raw response
          console.warn("JSON parsing failed for response:", e.message);
        }
      }
      return res;
    });
  }

  // --- Convenience Methods ---

  get(url: string, config: any) {
    return this.request(merge(config, { method: "get", url }));
  }

  post(url: string, data: any, config: any) {
    return this.request(merge(config, { method: "post", url, data }));
  }

  put(url: string, data: any, config: any) {
    return this.request(merge(config, { method: "put", url, data }));
  }

  delete(url: string, config: any) {
    return this.request(merge(config, { method: "delete", url }));
  }
}
