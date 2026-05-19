import xhrAdapter from "./xhr";
import httpAdapter from "./http";
import { merge, joinURL, buildURL } from "./utils";
import { DEFAULT_CONFIG } from "./config";

const isBrowser =
  typeof window !== "undefined" && typeof XMLHttpRequest !== "undefined";

export type InterceptorId = number;

class InterceptorManager<T> {
  private handlers: Array<{
    onFulfilled: (value: T) => T | Promise<T>;
    onRejected: (error: any) => any;
  } | null>;

  constructor() {
    this.handlers = [];
  }

  use(
    onFulfilled: (value: T) => T | Promise<T>,
    onRejected: (error: any) => any = (e) => Promise.reject(e)
  ): InterceptorId {
    this.handlers.push({ onFulfilled, onRejected });
    return this.handlers.length - 1;
  }

  eject(id: InterceptorId): void {
    if (this.handlers[id]) {
      this.handlers[id] = null;
    }
  }

  get active() {
    return this.handlers.filter(Boolean) as NonNullable<
      (typeof this.handlers)[number]
    >[];
  }
}

export default class Fetch {
  defaults: any;
  interceptors: {
    request: InterceptorManager<any>;
    response: InterceptorManager<any>;
  };

  constructor(defaultConfig: any = {}) {
    this.defaults = merge(DEFAULT_CONFIG, defaultConfig);
    this.interceptors = {
      request: new InterceptorManager(),
      response: new InterceptorManager(),
    };
  }

  request(config: any): Promise<any> {
    config = merge(this.defaults, config);
    config.method = (config.method || "get").toLowerCase();

    // Safe URL construction: use joinURL instead of naive string concatenation
    const finalUrl = config.baseURL
      ? joinURL(config.baseURL, config.url)
      : config.url;

    config.url = buildURL(finalUrl, config.params);

    // Automatic JSON request body serialization
    if (
      typeof config.data === "object" &&
      config.data !== null &&
      config.method !== "get" &&
      config.method !== "head"
    ) {
      config.headers = config.headers || {};
      if (!config.headers["Content-Type"] && !config.headers["content-type"]) {
        config.headers["Content-Type"] = "application/json";
      }
      config.data = JSON.stringify(config.data);
    }

    // Build interceptor chain (request interceptors run LIFO, response FIFO)
    const chain: any[] = [
      ...this.interceptors.request.active
        .map((i) => [i.onFulfilled, i.onRejected])
        .flat()
        .reverse(),

      this.dispatchRequest.bind(this),
      undefined,

      ...this.interceptors.response.active
        .map((i) => [i.onFulfilled, i.onRejected])
        .flat(),
    ];

    let promise = Promise.resolve(config);
    while (chain.length) {
      promise = promise.then(chain.shift(), chain.shift());
    }
    return promise;
  }

  dispatchRequest(config: any): Promise<any> {
    const adapter = isBrowser ? xhrAdapter : httpAdapter;

    return adapter(config).then((res: any) => {
      if (typeof res.data === "string" && res.data.length > 0) {
        try {
          const contentType =
            res.headers["content-type"] || res.headers["Content-Type"] || "";
          if (contentType.includes("application/json")) {
            res.data = JSON.parse(res.data);
          }
        } catch (e: any) {
          console.warn("JSON parsing failed for response:", e.message);
        }
      }
      return res;
    });
  }

  get(url: string, config?: any): Promise<any> {
    return this.request(merge(config, { method: "get", url }));
  }

  post(url: string, data?: any, config?: any): Promise<any> {
    return this.request(merge(config, { method: "post", url, data }));
  }

  put(url: string, data?: any, config?: any): Promise<any> {
    return this.request(merge(config, { method: "put", url, data }));
  }

  patch(url: string, data?: any, config?: any): Promise<any> {
    return this.request(merge(config, { method: "patch", url, data }));
  }

  delete(url: string, config?: any): Promise<any> {
    return this.request(merge(config, { method: "delete", url }));
  }

  head(url: string, config?: any): Promise<any> {
    return this.request(merge(config, { method: "head", url }));
  }

  options(url: string, config?: any): Promise<any> {
    return this.request(merge(config, { method: "options", url }));
  }
}
