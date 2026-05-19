# Usage Guide

Practical examples for every loony-fetch feature.

---

## Table of contents

1. [Making requests](#making-requests)
2. [Request config](#request-config)
3. [Response object](#response-object)
4. [URL parameters](#url-parameters)
5. [Request body](#request-body)
6. [Custom headers](#custom-headers)
7. [Timeout](#timeout)
8. [Cancellation with AbortController](#cancellation-with-abortcontroller)
9. [Error handling](#error-handling)
10. [Interceptors](#interceptors)
11. [Multiple instances](#multiple-instances)
12. [Redirect behaviour](#redirect-behaviour)
13. [Response size limit](#response-size-limit)
14. [XSRF protection](#xsrf-protection)

---

## Making requests

All methods return a `Promise` that resolves with a [response object](#response-object).

```ts
import fetch from "loony-fetch";

// Convenience methods
await fetch.get(url);
await fetch.post(url, data);
await fetch.put(url, data);
await fetch.patch(url, data);
await fetch.delete(url);
await fetch.head(url);
await fetch.options(url);

// Generic — pass a full config object
await fetch({ method: "get", url: "https://api.example.com/users" });
```

Every method accepts an optional `config` argument that overrides instance defaults:

```ts
await fetch.get("https://api.example.com/users", { timeout: 3000 });
await fetch.post("https://api.example.com/users", data, { headers: { "X-Request-Id": "abc" } });
```

---

## Request config

All available config keys:

```ts
{
  // Target URL (required unless baseURL covers the full path)
  url: "https://api.example.com/users",

  // HTTP method — case-insensitive, defaults to "get"
  method: "get",

  // Prepended to `url` using safe URL joining
  baseURL: "https://api.example.com",

  // Request headers
  headers: {
    Authorization: "Bearer token123",
    "X-Custom-Header": "value",
  },

  // URL query parameters — appended and encoded automatically
  params: { page: 1, limit: 20 },

  // Request body — objects are JSON-stringified automatically
  data: { name: "Alice" },

  // Milliseconds before the request times out (0 = no timeout)
  timeout: 5000,

  // Maximum response body size in bytes (-1 = unlimited)
  maxContentLength: 1_000_000, // 1 MB

  // AbortSignal for cancellation
  signal: controller.signal,

  // XSRF cookie and header names (browser only)
  xsrfCookieName: "XSRF-TOKEN",
  xsrfHeaderName: "X-XSRF-TOKEN",
}
```

---

## Response object

```ts
{
  data: any,           // parsed JSON or raw string
  status: number,      // HTTP status code
  statusText: string,  // HTTP status message
  headers: object,     // response headers (lowercase keys)
  config: object,      // the merged config used for this request
  request: object,     // the underlying Node IncomingMessage or XHR object
}
```

Example:

```ts
const res = await fetch.get("https://api.example.com/users/1");

console.log(res.status);       // 200
console.log(res.statusText);   // "OK"
console.log(res.data);         // { id: 1, name: "Alice" }
console.log(res.headers["content-type"]); // "application/json"
```

---

## URL parameters

Pass an object to `params` — keys and values are percent-encoded automatically.

```ts
const res = await fetch.get("https://api.example.com/users", {
  params: { page: 2, search: "alice smith" },
});
// Requests: GET https://api.example.com/users?page=2&search=alice%20smith
```

If the base URL already has a query string, params are appended with `&`:

```ts
await fetch.get("https://api.example.com/users?active=true", {
  params: { page: 1 },
});
// GET https://api.example.com/users?active=true&page=1
```

---

## Request body

Objects passed as `data` are automatically serialized to JSON and `Content-Type: application/json` is set unless you override it.

```ts
// Object — serialized automatically
await fetch.post("https://api.example.com/users", {
  name: "Alice",
  role: "admin",
});

// Pre-serialized string — sent as-is
await fetch.post("https://api.example.com/raw", JSON.stringify({ x: 1 }), {
  headers: { "Content-Type": "application/json" },
});

// Form data (no auto-serialization)
await fetch.post("https://api.example.com/upload", formData, {
  headers: { "Content-Type": "multipart/form-data" },
});
```

---

## Custom headers

```ts
await fetch.get("https://api.example.com/protected", {
  headers: {
    Authorization: "Bearer eyJhbGci...",
    "Accept-Language": "en-US",
  },
});
```

Headers set on an instance's `defaults` are merged with per-request headers. Per-request headers win on conflict.

```ts
const api = fetch.create({
  baseURL: "https://api.example.com",
  headers: { Authorization: "Bearer token" },
});

// This request also sends Authorization
await api.get("/users");

// This request overrides the default Authorization
await api.get("/admin", { headers: { Authorization: "Bearer admin-token" } });
```

---

## Timeout

```ts
try {
  await fetch.get("https://api.example.com/slow", { timeout: 2000 });
} catch (err) {
  if (err.code === "ECONNABORTED") {
    console.error("Request timed out");
  }
}
```

A timeout of `0` (the default) means no timeout.

---

## Cancellation with AbortController

```ts
const controller = new AbortController();

// Cancel after 1 second
setTimeout(() => controller.abort(), 1000);

try {
  const res = await fetch.get("https://api.example.com/data", {
    signal: controller.signal,
  });
} catch (err) {
  if (err.code === "ERR_CANCELED") {
    console.log("Request was cancelled");
  }
}
```

You can also cancel inside a React effect cleanup, for example:

```ts
useEffect(() => {
  const controller = new AbortController();

  fetch.get("/api/data", { signal: controller.signal })
    .then((res) => setData(res.data))
    .catch((err) => {
      if (err.code !== "ERR_CANCELED") throw err;
    });

  return () => controller.abort();
}, []);
```

---

## Error handling

Non-2xx responses, network failures, timeouts, and cancellations all reject the promise with an `Error` object that carries extra properties.

```ts
try {
  await fetch.get("https://api.example.com/users/999");
} catch (err) {
  console.error(err.message);       // "Request failed with status code 404"
  console.error(err.response?.status);   // 404
  console.error(err.response?.data);     // server error body
  console.error(err.config?.url);        // original URL
  console.error(err.code);              // e.g. "ECONNABORTED", "ERR_CANCELED"
}
```

Error codes:

| Code | Cause |
|---|---|
| `ECONNABORTED` | Timeout exceeded |
| `ERR_CANCELED` | Aborted via `AbortController` |
| `ERR_TOO_MANY_REDIRECTS` | More than 5 redirect hops |
| `ERR_CONTENT_LENGTH_EXCEEDED` | Response body exceeded `maxContentLength` |

---

## Interceptors

Interceptors let you transform requests before they are sent and responses before they reach your code.

### Request interceptor

```ts
const id = fetch.interceptors.request.use(
  (config) => {
    // Add an auth header to every request
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${getToken()}`;
    return config;
  },
  (error) => Promise.reject(error)
);

// Remove later
fetch.interceptors.request.eject(id);
```

### Response interceptor

```ts
const id = fetch.interceptors.response.use(
  (response) => {
    // Unwrap the envelope before your code sees the response
    return { ...response, data: response.data.payload };
  },
  (error) => {
    // Global 401 handler
    if (error.response?.status === 401) {
      redirectToLogin();
    }
    return Promise.reject(error);
  }
);
```

### Execution order

- **Request interceptors** run in last-in, first-out (LIFO) order before the request.
- **Response interceptors** run in first-in, first-out (FIFO) order after the response.

---

## Multiple instances

Use `fetch.create(config)` to get an isolated instance with its own defaults and interceptors.

```ts
const github = fetch.create({
  baseURL: "https://api.github.com",
  headers: { Authorization: `token ${GITHUB_TOKEN}` },
  timeout: 8000,
});

const stripe = fetch.create({
  baseURL: "https://api.stripe.com/v1",
  headers: { Authorization: `Bearer ${STRIPE_KEY}` },
});

const { data: repos } = await github.get("/user/repos");
const { data: charges } = await stripe.get("/charges");
```

Each instance has its own `interceptors`, `defaults`, and does not share state with other instances.

---

## Redirect behaviour

loony-fetch automatically follows HTTP redirects in Node.js, up to **5 hops**.

- **301, 302, 303** — the method is downgraded to `GET` and the body is dropped (RFC 7231 §6.4).
- **307, 308** — the original method and body are preserved.
- Redirect targets are scheme-validated; a redirect to `file://` or `ftp://` will throw.
- Exceeding 5 redirects rejects with `ERR_TOO_MANY_REDIRECTS`.

There is no redirect configuration in the browser adapter; the browser controls redirect behaviour natively.

---

## Response size limit

Prevent unbounded memory usage by setting `maxContentLength` (in bytes):

```ts
const res = await fetch.get("https://example.com/large-file", {
  maxContentLength: 5 * 1024 * 1024, // 5 MB
});
```

If the response body exceeds the limit, the socket is destroyed and the promise rejects with `ERR_CONTENT_LENGTH_EXCEEDED`. The default is `-1` (unlimited).

---

## XSRF protection

In browser environments, loony-fetch reads the cookie named `xsrfCookieName` (default: `XSRF-TOKEN`) and attaches its value as the header named `xsrfHeaderName` (default: `X-XSRF-TOKEN`) — but **only for same-origin requests**.

Cross-origin requests never receive the token, preventing the credential-leakage class of vulnerability (CVE-2023-45857 in axios).

```ts
// Override names to match your server's expectations
const api = fetch.create({
  baseURL: "https://myapp.example.com/api",
  xsrfCookieName: "csrf_token",
  xsrfHeaderName: "X-CSRF-Token",
});
```
