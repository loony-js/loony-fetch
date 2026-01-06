// mini-axios/utils.js

export function isObject(val: any): val is Object {
  return val !== null && typeof val === "object";
}

/**
 * Deep merge function for config objects.
 */
export function merge(...objs: any[]): any {
  return objs.reduce((acc, obj) => {
    if (!obj) return acc;
    Object.keys(obj).forEach((key) => {
      acc[key] =
        isObject(acc[key]) && isObject(obj[key])
          ? merge(acc[key], obj[key])
          : obj[key];
    });
    return acc;
  }, {});
}

/**
 * Appends URL parameters to the URL string.
 */
export function buildURL(url: string, params: any): string {
  if (!params) return url;
  const query = Object.keys(params)
    .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(params[k])}`)
    .join("&");
  return query ? `${url}${url.includes("?") ? "&" : "?"}${query}` : url;
}

/**
 * Simple utility to parse raw header string from XHR.
 */
export function parseHeaders(headers: string): Record<string, string> {
  const parsed: any = {};
  if (!headers) return parsed;

  headers.split("\n").forEach((line) => {
    const parts: any = line.split(":");
    const key = parts.shift().trim();
    if (key) {
      parsed[key.toLowerCase()] = parts.join(":").trim();
    }
  });
  return parsed;
}
