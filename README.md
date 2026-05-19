# loony-fetch

A lightweight, secure HTTP client for Node.js and the browser. Built on native `http`/`https` (Node) and `XMLHttpRequest` (browser), with a `Promise`-based API, interceptors, automatic JSON handling, redirect following, request cancellation, and a hardened security model informed by real-world vulnerabilities found in popular HTTP clients (see [Security](#security)).

---

## Features

- Works in **Node.js ≥ 18** and the **browser**
- `Promise`-based API with convenience methods: `get`, `post`, `put`, `patch`, `delete`, `head`, `options`
- Automatic JSON body serialization and response deserialization
- Request and response **interceptors** with `eject` support
- **Redirect following** — up to 5 hops, RFC 7231-compliant method downgrade on 301/302/303
- **`AbortController` / `AbortSignal`** for cancellable requests
- Configurable **timeout** and **response size limit** (`maxContentLength`)
- Multiple isolated instances via `fetch.create(config)`
- Full TypeScript types included

### Security hardening

- **Prototype pollution prevention** — config merging and URL parameter building block `__proto__`, `constructor`, and `prototype` keys
- **HTTP header injection prevention** — `\r\n` stripped from all header values before they reach the transport layer
- **URL scheme validation** — only `http:` and `https:` are accepted; `file://`, `ftp://`, `javascript:` etc. are rejected
- **XSRF token scoped to same-origin** — the `X-XSRF-TOKEN` header is sent only when the request targets the same origin as the page (fixes the CVE-2023-45857 class of bug present in axios)
- **Redirect target validation** — redirect `Location` URLs are also scheme-validated

---

## Installation

```bash
npm install loony-fetch
```

---

## Quick start

```ts
import fetch from "loony-fetch";

// GET
const res = await fetch.get("https://api.example.com/users");
console.log(res.data); // already parsed if Content-Type is application/json

// POST with a JSON body (Content-Type set automatically)
await fetch.post("https://api.example.com/users", { name: "Alice" });

// Full config object
await fetch({
  method: "get",
  url: "https://api.example.com/users",
  params: { page: 1, limit: 20 },
  timeout: 5000,
});
```

---

## Documentation

| Document | Description |
|---|---|
| [docs/usage.md](docs/usage.md) | Practical examples for every feature |
| [docs/api.md](docs/api.md) | Full API and config reference |
| [docs/security.md](docs/security.md) | Security model and hardening details |

---

## Security

loony-fetch was designed with the security history of popular HTTP clients in mind. The most notable issues it addresses:

- **CVE-2023-45857 (axios)** — XSRF tokens were forwarded to cross-origin servers. loony-fetch reads the XSRF cookie and attaches the header only when the request target shares the same origin as `window.location`.
- **Prototype pollution** — Malicious keys in config objects or URL params could mutate `Object.prototype`. loony-fetch uses a blocklist and `Object.create(null)` to prevent this.
- **Header injection** — Unvalidated header values containing `\r\n` could inject arbitrary HTTP headers. All values are sanitized before reaching the transport layer.

Full details: [docs/security.md](docs/security.md)

---

## License

ISC — Sankar Boro
