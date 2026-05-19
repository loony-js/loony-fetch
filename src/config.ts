export const DEFAULT_CONFIG = {
  baseURL: undefined,
  timeout: 0, // no timeout
  headers: {
    common: {
      Accept: "application/json, text/plain, */*",
    },
  },
  transformRequest: [
    function (data: any, headers: any) {
      if (typeof data === "object" && data !== null) {
        return JSON.stringify(data);
      }
      return data;
    },
  ],
  transformResponse: [
    function (data: any) {
      try {
        return JSON.parse(data);
      } catch {
        return data;
      }
    },
  ],
  xsrfCookieName: "XSRF-TOKEN",
  xsrfHeaderName: "X-XSRF-TOKEN",
  maxContentLength: -1, // unlimited
  maxBodyLength: -1, // unlimited
  validateStatus: function (status: any) {
    return status >= 200 && status < 300;
  },
};

export const HEADERS = {
  common: {
    Accept: "application/json, text/plain, */*",
  },
  delete: {},
  get: {},
  head: {},
  post: { "Content-Type": "application/json" },
  put: { "Content-Type": "application/json" },
  patch: { "Content-Type": "application/json" },
};
