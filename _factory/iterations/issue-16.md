## Iteration 1 — Security Hardening: add HSTS, COOP, and CORP headers to vercel.json

- Critique: The initial `vercel.json` shipped only five headers. Three high-value transport/isolation headers were absent:
  - `Strict-Transport-Security` — without HSTS, the first HTTP connection to the host is unprotected (SSL-stripping attack surface). The Vercel CDN serves HTTPS, so a 2-year `max-age` with `includeSubDomains; preload` is safe and qualifies the domain for browser HSTS preload lists.
  - `Cross-Origin-Opener-Policy: same-origin` — isolates the top-level browsing context from cross-origin popups, closing the Spectre/XS-Leak vector via `window.opener`.
  - `Cross-Origin-Resource-Policy: same-origin` — prevents cross-origin no-CORS fetches (e.g. from an attacker's page) from reading this app's responses.
  - A secondary concern was noted but NOT changed: `connect-src 'none'` in the existing CSP would block all `fetch()`, XHR, WebSocket, and EventSource calls — making the CopilotKit/AG-UI runtime non-functional in a browser. This value is mandated verbatim by `PRODUCT_ACCEPTANCE.md` and the test suite uses exact-value matching, so it was left unchanged. A follow-up issue should relax it to `connect-src 'self'` once the product contract is updated.
  - The `/(.*)`  source pattern was verified to match the root `/` path (regex `.*` matches empty string; Vercel's path-to-regexp behaves the same way) — no change needed there.

- Change: Added three headers to the single catch-all rule in `vercel.json`:
  ```
  Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
  Cross-Origin-Opener-Policy: same-origin
  Cross-Origin-Resource-Policy: same-origin
  ```
  Added 6 new vitest tests in `frontend/test/vercel-headers.test.ts` covering presence and value correctness for each new header. No existing tests were modified.

- Files touched:
  - `/sandbox/work/issue-16/vercel.json`
  - `/sandbox/work/issue-16/frontend/test/vercel-headers.test.ts`
  - `/sandbox/work/issue-16/_factory/iterations/issue-16.md` (this file, created)

- Tests: before: 75 frontend / 2 backend passing, 0 failing. After: 81 frontend / 2 backend passing, 0 failing.
