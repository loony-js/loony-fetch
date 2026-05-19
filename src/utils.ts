const DANGEROUS_KEYS = new Set(["__proto__", "constructor", "prototype"]);

export function isObject(val: any): val is Record<string, unknown> {
  return val !== null && typeof val === "object" && !Array.isArray(val);
}

/**
 * Deep merge function for config objects.
 * Guards against prototype pollution via __proto__, constructor, and prototype keys.
 */
export function merge(...objs: any[]): any {
  return objs.reduce((acc, obj) => {
    if (!obj) return acc;
    Object.keys(obj).forEach((key) => {
      if (DANGEROUS_KEYS.has(key)) return;
      acc[key] =
        isObject(acc[key]) && isObject(obj[key])
          ? merge(acc[key], obj[key])
          : obj[key];
    });
    return acc;
  }, Object.create(null));
}

/**
 * Appends URL parameters to the URL string.
 * Guards against prototype pollution via __proto__ and similar keys.
 */
export function buildURL(url: string, params: any): string {
  if (!params) return url;
  const query = Object.keys(params)
    .filter((k) => !DANGEROUS_KEYS.has(k) && Object.prototype.hasOwnProperty.call(params, k))
    .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(params[k])}`)
    .join("&");
  return query ? `${url}${url.includes("?") ? "&" : "?"}${query}` : url;
}

/**
 * Simple utility to parse raw header string from XHR.
 */
export function parseHeaders(headers: string): Record<string, string> {
  const parsed: Record<string, string> = {};
  if (!headers) return parsed;

  headers.split("\n").forEach((line) => {
    const parts = line.split(":");
    const key = parts.shift()!.trim();
    if (key) {
      parsed[key.toLowerCase()] = parts.join(":").trim();
    }
  });
  return parsed;
}

/**
 * Sanitize a header value to prevent HTTP header injection.
 * Strips carriage returns and newlines.
 */
export function sanitizeHeaderValue(value: string): string {
  return String(value).replace(/[\r\n]/g, "");
}

/**
 * Validate that the URL uses an allowed scheme (http or https only).
 * Throws for disallowed schemes to prevent SSRF via file://, ftp://, etc.
 */
export function validateURL(url: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`Invalid URL: ${url}`);
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error(
      `Disallowed URL scheme "${parsed.protocol}". Only http and https are allowed.`
    );
  }
  return parsed;
}

/**
 * Join a baseURL and a relative URL safely using the URL constructor.
 */
export function joinURL(baseURL: string, relativeURL: string): string {
  if (!relativeURL) return baseURL;
  if (!baseURL) return relativeURL;
  const base = baseURL.endsWith("/") ? baseURL : baseURL + "/";
  const rel = relativeURL.startsWith("/") ? relativeURL.slice(1) : relativeURL;
  return new URL(rel, base).toString();
}

/**
 * Check whether two URLs share the same origin.
 */
export function isSameOrigin(urlA: string, urlB: string): boolean {
  try {
    return new URL(urlA).origin === new URL(urlB).origin;
  } catch {
    return false;
  }
}
