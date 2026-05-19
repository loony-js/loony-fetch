# Security

loony-fetch was designed with the security history of real-world HTTP clients in mind. This document describes every security control in the library, the threat it addresses, and where the code lives.

---

## Table of contents

1. [XSRF token scoped to same-origin](#1-xsrf-token-scoped-to-same-origin)
2. [Prototype pollution prevention](#2-prototype-pollution-prevention)
3. [HTTP header injection prevention](#3-http-header-injection-prevention)
4. [URL scheme validation](#4-url-scheme-validation)
5. [Redirect safety](#5-redirect-safety)
6. [Response size limit](#6-response-size-limit)
7. [Reporting a vulnerability](#reporting-a-vulnerability)

---

## 1. XSRF token scoped to same-origin

**Threat:** CSRF token leakage to third-party servers.

**Background:** CVE-2023-45857 found that axios sent the value of the `XSRF-TOKEN` cookie in the `X-XSRF-TOKEN` request header for *every* request, regardless of whether the request was same-origin or cross-origin. A page that made a credentialed request to an attacker-controlled server (e.g., via a misconfigured `baseURL` or a redirect) would expose its CSRF token.

**How loony-fetch addresses it:** In the browser adapter ([src/xhr.ts](../src/xhr.ts)), the XSRF cookie is read and the header is attached **only** when the request URL shares the same origin as `window.location`:

```ts
if (config.xsrfCookieName && config.xsrfHeaderName) {
  const currentOrigin = window.location.href;
  if (isSameOrigin(config.url, currentOrigin)) {
    const xsrfValue = getCookie(config.xsrfCookieName);
    if (xsrfValue) {
      xhr.setRequestHeader(config.xsrfHeaderName, xsrfValue);
    }
  }
}
```

Cross-origin requests never receive the token.

**Configuration:**

```ts
const api = fetch.create({
  xsrfCookieName: "csrf_token",      // cookie name your server sets
  xsrfHeaderName: "X-CSRF-Token",    // header name your server reads
});
```

---

## 2. Prototype pollution prevention

**Threat:** Attacker-controlled keys like `__proto__`, `constructor`, or `prototype` in a config or params object could mutate `Object.prototype`, affecting the entire runtime.

**Where it could occur:**
- The `merge()` utility used to combine default config with per-request config.
- The `buildURL()` utility used to append query parameters to the URL.

**How loony-fetch addresses it** ([src/utils.ts](../src/utils.ts)):

```ts
const DANGEROUS_KEYS = new Set(["__proto__", "constructor", "prototype"]);

export function merge(...objs: any[]): any {
  return objs.reduce((acc, obj) => {
    if (!obj) return acc;
    Object.keys(obj).forEach((key) => {
      if (DANGEROUS_KEYS.has(key)) return; // silently dropped
      acc[key] = isObject(acc[key]) && isObject(obj[key])
        ? merge(acc[key], obj[key])
        : obj[key];
    });
    return acc;
  }, Object.create(null)); // null prototype — nothing to pollute
}, {});
```

`Object.create(null)` means the accumulator itself has no prototype, so even if a dangerous key were to slip through, there would be nothing to pollute.

`buildURL()` applies the same blocklist and uses `Object.prototype.hasOwnProperty.call` to avoid inherited keys.

---

## 3. HTTP header injection prevention

**Threat:** If a header value contains a carriage return (`\r`) or newline (`\n`), an attacker can inject additional HTTP headers or split the response (HTTP response splitting / request smuggling).

Example of a malicious value:
```
Authorization: Bearer token\r\nX-Injected: evil
```

**How loony-fetch addresses it** ([src/utils.ts](../src/utils.ts)):

```ts
export function sanitizeHeaderValue(value: string): string {
  return String(value).replace(/[\r\n]/g, "");
}
```

This function is applied to every header key and value before they are passed to Node's `http.request` ([src/http.ts](../src/http.ts)) or XHR's `setRequestHeader` ([src/xhr.ts](../src/xhr.ts)).

---

## 4. URL scheme validation

**Threat:** Server-side request forgery (SSRF) via non-HTTP URL schemes.

If an attacker can control the `url` or `baseURL` config values they could supply a URL like `file:///etc/passwd`, `ftp://internal-server/`, or `javascript:alert(1)`. Node's `http.request` does not validate schemes — it would simply fail in unexpected ways or expose local files.

**How loony-fetch addresses it** ([src/utils.ts](../src/utils.ts)):

```ts
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
```

`validateURL` is called in the Node HTTP adapter ([src/http.ts](../src/http.ts)) before any network connection is opened, and again on every redirect target before it is followed.

---

## 5. Redirect safety

**Threat:** Redirect chains can be used to:
- Bypass scheme validation (redirect to `file://` after an initial `https://` request).
- Cause denial of service via infinite redirect loops.
- Leak request bodies or auth headers to unintended servers.

**How loony-fetch addresses it** ([src/http.ts](../src/http.ts)):

| Control | Behaviour |
|---|---|
| **Scheme validation on targets** | Every `Location` URL is passed through `validateURL` before the redirect is followed. A redirect to a non-HTTP/S scheme throws. |
| **Maximum hops** | Redirects are followed for at most **5** hops. Exceeding this rejects with `ERR_TOO_MANY_REDIRECTS`. |
| **Method downgrade** | On 301, 302, and 303 responses, the method is changed to `GET` and the request body is dropped, per RFC 7231 §6.4. This prevents unintentional mutation of the redirect target. |
| **Relative Location support** | Relative `Location` headers are resolved against the current request URL using the `URL` constructor, so they cannot escape the host via path traversal. |

---

## 6. Response size limit

**Threat:** A server (or attacker-controlled endpoint) returning a very large body can exhaust the Node.js process heap.

**How loony-fetch addresses it** ([src/http.ts](../src/http.ts)):

The `maxContentLength` config value (default: `-1`, unlimited) is enforced as incoming chunks arrive. When the running byte count exceeds the limit, the socket is immediately destroyed and the promise rejects with `ERR_CONTENT_LENGTH_EXCEEDED`.

```ts
await fetch.get("https://example.com/data", {
  maxContentLength: 10 * 1024 * 1024, // 10 MB hard cap
});
```

This is a Node-only control; the browser enforces its own memory limits.

---

## Reporting a vulnerability

If you discover a security issue in loony-fetch, please open an issue on the project repository with the label `security`. Provide a description of the vulnerability, steps to reproduce, and potential impact. Do not include working exploit code in a public issue — contact the maintainer privately first if the issue is critical.
