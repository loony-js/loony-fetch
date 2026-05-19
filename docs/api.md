# API Reference

---

## Table of contents

1. [Default instance](#default-instance)
2. [fetch(config)](#fetchconfig)
3. [Convenience methods](#convenience-methods)
4. [fetch.create(config)](#fetchcreateconfig)
5. [Request config](#request-config)
6. [Response object](#response-object)
7. [Default config](#default-config)
8. [Interceptors](#interceptors)
9. [Error object](#error-object)

---

## Default instance

```ts
import fetch from "loony-fetch";
```

`fetch` is a pre-built instance with the [default config](#default-config) applied. It is callable directly as a function or via its convenience methods.

---

## fetch(config)

```ts
fetch(config: RequestConfig): Promise<Response>
```

Make an HTTP request with a full config object.

```ts
const res = await fetch({
  method: "post",
  url: "https://api.example.com/users",
  data: { name: "Alice" },
  timeout: 5000,
});
```

---

## Convenience methods

All convenience methods are available on the default instance and on any instance returned by `fetch.create()`.

### fetch.get(url, config?)

```ts
fetch.get(url: string, config?: RequestConfig): Promise<Response>
```

### fetch.post(url, data?, config?)

```ts
fetch.post(url: string, data?: any, config?: RequestConfig): Promise<Response>
```

### fetch.put(url, data?, config?)

```ts
fetch.put(url: string, data?: any, config?: RequestConfig): Promise<Response>
```

### fetch.patch(url, data?, config?)

```ts
fetch.patch(url: string, data?: any, config?: RequestConfig): Promise<Response>
```

### fetch.delete(url, config?)

```ts
fetch.delete(url: string, config?: RequestConfig): Promise<Response>
```

### fetch.head(url, config?)

```ts
fetch.head(url: string, config?: RequestConfig): Promise<Response>
```

### fetch.options(url, config?)

```ts
fetch.options(url: string, config?: RequestConfig): Promise<Response>
```

---

## fetch.create(config)

```ts
fetch.create(config?: RequestConfig): FetchInstance
```

Create a new isolated instance with its own defaults and interceptors. The provided config is deep-merged over the [default config](#default-config).

```ts
const api = fetch.create({
  baseURL: "https://api.example.com",
  timeout: 10_000,
  headers: { Authorization: "Bearer token" },
});

await api.get("/users");
await api.post("/users", { name: "Alice" });
```

Instances do not share interceptors or defaults with each other or with the default `fetch` instance.

---

## Request config

All fields are optional unless noted.

| Field | Type | Default | Description |
|---|---|---|---|
| `url` | `string` | — | **(required)** Full URL or path relative to `baseURL`. Must use `http:` or `https:` scheme. |
| `method` | `string` | `"get"` | HTTP method. Case-insensitive. |
| `baseURL` | `string` | `undefined` | Prepended to `url` using safe URL joining. |
| `headers` | `Record<string, string>` | `{}` | Request headers. Values are sanitized to remove `\r\n`. |
| `params` | `Record<string, any>` | `undefined` | URL query parameters. Keys and values are percent-encoded. |
| `data` | `any` | `undefined` | Request body. Plain objects are JSON-stringified and `Content-Type: application/json` is set automatically. |
| `timeout` | `number` | `0` | Request timeout in milliseconds. `0` means no timeout. |
| `maxContentLength` | `number` | `-1` | Maximum response body size in bytes. `-1` means unlimited. Enforced in Node only. |
| `signal` | `AbortSignal` | `undefined` | Cancellation signal from an `AbortController`. |
| `xsrfCookieName` | `string` | `"XSRF-TOKEN"` | Name of the cookie to read the XSRF token from (browser only). |
| `xsrfHeaderName` | `string` | `"X-XSRF-TOKEN"` | Name of the request header to attach the XSRF token to (browser only, same-origin only). |

---

## Response object

Resolved by the returned `Promise` on any 2xx response.

| Field | Type | Description |
|---|---|---|
| `data` | `any` | Response body. Parsed as JSON if `Content-Type` is `application/json`, otherwise a raw string. |
| `status` | `number` | HTTP status code. |
| `statusText` | `string` | HTTP status message. |
| `headers` | `Record<string, string>` | Response headers with lowercase keys. |
| `config` | `RequestConfig` | The merged config used for this request. |
| `request` | `object` | The underlying Node `ClientRequest` (Node) or `XMLHttpRequest` (browser). |

---

## Default config

The following defaults are applied to every instance and every request:

```ts
{
  baseURL: undefined,
  timeout: 0,
  headers: {
    common: {
      Accept: "application/json, text/plain, */*",
    },
  },
  xsrfCookieName: "XSRF-TOKEN",
  xsrfHeaderName: "X-XSRF-TOKEN",
  maxContentLength: -1,
}
```

Override defaults on the default instance:

```ts
fetch.defaults.baseURL = "https://api.example.com";
fetch.defaults.timeout = 10_000;
fetch.defaults.headers.Authorization = "Bearer token";
```

Or supply them at creation time:

```ts
const api = fetch.create({ baseURL: "https://api.example.com", timeout: 10_000 });
```

---

## Interceptors

### interceptors.request.use(onFulfilled, onRejected?)

```ts
use(
  onFulfilled: (config: RequestConfig) => RequestConfig | Promise<RequestConfig>,
  onRejected?: (error: any) => any
): InterceptorId
```

Register a request interceptor. `onFulfilled` receives the merged config before the request is sent and must return a (possibly modified) config. Returns a numeric `InterceptorId`.

```ts
const id = fetch.interceptors.request.use((config) => {
  config.headers = config.headers || {};
  config.headers.Authorization = `Bearer ${token}`;
  return config;
});
```

### interceptors.response.use(onFulfilled, onRejected?)

```ts
use(
  onFulfilled: (response: Response) => Response | Promise<Response>,
  onRejected?: (error: any) => any
): InterceptorId
```

Register a response interceptor. `onFulfilled` receives the response object after the request completes. Returns a numeric `InterceptorId`.

```ts
const id = fetch.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) logout();
    return Promise.reject(err);
  }
);
```

### interceptors.request.eject(id) / interceptors.response.eject(id)

```ts
eject(id: InterceptorId): void
```

Remove a previously registered interceptor by its ID. Ejected interceptors are skipped during request processing.

```ts
fetch.interceptors.request.eject(id);
```

### Execution order

- Request interceptors run **LIFO** (last registered, first executed).
- Response interceptors run **FIFO** (first registered, first executed).

---

## Error object

Non-2xx responses, network errors, timeouts, cancellations, and validation errors all reject with a standard `Error` extended with additional properties.

| Property | Type | Description |
|---|---|---|
| `message` | `string` | Human-readable description. |
| `code` | `string` | Machine-readable error code (see table below). |
| `config` | `RequestConfig` | The config used when the error occurred. |
| `request` | `object` | The underlying request object. |
| `response` | `Response \| undefined` | The response object, present only for HTTP errors (non-2xx). |

### Error codes

| Code | Cause |
|---|---|
| `ECONNABORTED` | Timeout exceeded (`config.timeout`). |
| `ERR_CANCELED` | Request aborted via `AbortController`. |
| `ERR_TOO_MANY_REDIRECTS` | More than 5 consecutive redirects (Node only). |
| `ERR_CONTENT_LENGTH_EXCEEDED` | Response body exceeded `maxContentLength` (Node only). |

```ts
try {
  await fetch.get("https://api.example.com/resource");
} catch (err) {
  // HTTP error — response is available
  if (err.response) {
    console.error(err.response.status, err.response.data);
  }
  // Network or validation error — no response
  else if (err.code === "ECONNABORTED") {
    console.error("Timed out");
  } else if (err.code === "ERR_CANCELED") {
    console.error("Cancelled");
  } else {
    console.error("Network error:", err.message);
  }
}
```
