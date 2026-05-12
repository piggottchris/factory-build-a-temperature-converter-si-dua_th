# Product Acceptance Contract — Issue #16

## Feature
Static host deploy config: config file emitting all five required security headers.

## Product Archetype
Infrastructure / security hardening layer for the temperature-converter POC.  
Commits a host-specific deployment configuration file so that every response
from the chosen CDN/host carries the five mandated security headers.

## Primary User Journey
1. A developer commits `vercel.json` (or equivalent) to the repo.
2. On deploy, the CDN/host picks up the header rules automatically.
3. Running `curl -I <deployed-url>` shows all five security headers with exact required values.
4. A static validation script (`check:security`) can verify the config file in CI without a live deployment.

## Requirements

### Deployment configuration file
- File: `vercel.json` at the repo root
- Applies to all routes (`/(.*)`):

| Header | Required value |
|--------|---------------|
| `Content-Security-Policy` | `default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'none'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'` |
| `X-Content-Type-Options` | `nosniff` |
| `X-Frame-Options` | `DENY` |
| `Referrer-Policy` | `no-referrer` |
| `Permissions-Policy` | `accelerometer=(), camera=(), clipboard-read=(), clipboard-write=(), geolocation=(), gyroscope=(), microphone=(), usb=()` |

### Static validation
- A `check:security` npm script in `frontend/package.json` validates the config file offline.
- Vitest unit tests in `frontend/test/vercel-headers.test.ts` assert all five headers with exact values.

### Security
- All headers follow the principle of least privilege (allowlist approach).
- `X-Frame-Options: DENY` and `frame-ancestors 'none'` in CSP provide double protection against clickjacking.
- GitHub Pages is explicitly excluded; Vercel is the target host.

### Observability
N/A — this is a static config file; no runtime observability hooks needed.

## Success Criteria
- [ ] `vercel.json` exists at the repo root
- [ ] `vercel.json` applies headers to all routes via `/(.*)`
- [ ] All 5 headers present with exact required values in `vercel.json`
- [ ] `frontend/test/vercel-headers.test.ts` tests pass (vitest green)
- [ ] `check:security` script added to `frontend/package.json`
- [ ] `npm test` in `frontend/` exits 0
- [ ] No existing tests broken

## Known Limitations
- Actual header delivery can only be verified against a live Vercel deployment (not testable in CI without deployment).
- The `check:security` CI integration (a next task per issue body) is beyond this issue's scope — this issue adds the config file and a static validator only.
