# Product Acceptance Contract — Issue #16

## Feature
Static host deploy config: config file emitting all required security headers.

## Product Archetype
Infrastructure / security hardening layer for the temperature-converter POC.  
Commits a host-specific deployment configuration file so that every response
from the chosen CDN/host carries the mandated security headers.

## Primary User Journey
1. A developer commits `vercel.json` (or equivalent) to the repo.
2. On deploy, the CDN/host picks up the header rules automatically.
3. Running `curl -I <deployed-url>` shows all required security headers with exact required values.
4. A static validation script (`check:security`) can verify the config file in CI without a live deployment.

## Requirements

### Deployment configuration file
- File: `vercel.json` at the repo root
- Applies to all routes (`/(.*)`):

#### Contract headers (original five — exact values required)

| Header | Required value |
|--------|---------------|
| `Content-Security-Policy` | `default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'none'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'` |
| `X-Content-Type-Options` | `nosniff` |
| `X-Frame-Options` | `DENY` |
| `Referrer-Policy` | `no-referrer` |
| `Permissions-Policy` | `accelerometer=(), camera=(), clipboard-read=(), clipboard-write=(), geolocation=(), gyroscope=(), microphone=(), usb=()` |

#### Hardening headers (added in Security Hardening pass — three additional)

| Header | Required value | Rationale |
|--------|---------------|-----------|
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains; preload` | Forces HTTPS for 2 years; qualifies for browser preload list |
| `Cross-Origin-Opener-Policy` | `same-origin` | Isolates browsing context; closes Spectre/XS-Leak via `window.opener` |
| `Cross-Origin-Resource-Policy` | `same-origin` | Prevents cross-origin no-CORS reads of this app's responses |

### Static validation
- A `check:security` npm script in `frontend/package.json` validates the config file offline. It runs both `test/vercel-headers.test.ts` (24 tests) and `test/next-config-headers.test.ts` (5 tests).
- Vitest unit tests in `frontend/test/vercel-headers.test.ts` assert all eight headers (exact values for the five contract headers; structural checks for the three hardening headers).
- Vitest unit tests in `frontend/test/next-config-headers.test.ts` assert that `next.config.mjs` exports a `headers()` function with values that match `vercel.json` exactly, preventing silent drift between the two config files.

### Security
- All headers follow the principle of least privilege (allowlist approach).
- `X-Frame-Options: DENY` and `frame-ancestors 'none'` in CSP provide double protection against clickjacking.
- GitHub Pages is explicitly excluded; Vercel is the target host.

### Observability
N/A — this is a static config file; no runtime observability hooks needed.

## Success Criteria
- [x] `vercel.json` exists at the repo root
- [x] `vercel.json` applies headers to all routes via `/(.*)`
- [x] All 5 contract headers present with exact required values in `vercel.json`
- [x] All 3 hardening headers (HSTS, COOP, CORP) present with correct values in `vercel.json`
- [x] `frontend/next.config.mjs` exports a `headers()` function with all 8 headers matching `vercel.json` (local/Docker dev parity)
- [x] `frontend/test/vercel-headers.test.ts` tests pass — 24 tests (vitest green)
- [x] `frontend/test/next-config-headers.test.ts` tests pass — 5 tests (vitest green)
- [x] `check:security` script runs both test files (`vercel-headers.test.ts` and `next-config-headers.test.ts`)
- [x] `npm run check:security` in `frontend/` exits 0 with 29 tests passing
- [x] `npm test` in `frontend/` exits 0
- [x] No existing tests broken

## Known Limitations
- Actual header delivery can only be verified against a live Vercel deployment (not testable in CI without deployment).
- The `check:security` script validates the static config files offline. End-to-end HTTP header verification (via `curl -I`) requires a live deployed environment.
- `connect-src 'none'` in the CSP will block all `fetch()`, XHR, WebSocket, and EventSource calls in the browser, making the CopilotKit/AG-UI runtime non-functional in a browser. This value is mandated verbatim by the issue contract and kept as specified. A follow-up issue should relax it to `connect-src 'self'` once the product contract is updated.
