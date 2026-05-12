# Product Acceptance Contract — Issue #18

## Feature
`scripts/check-security.js`: static CI validation script for CSP header config, SRI attributes, and inline-script/style absence.

## Product Archetype
Developer tooling / CI security gate for the temperature-converter POC. The script validates that the deployed HTML artifact and server-response headers satisfy a minimal Content Security Policy baseline, blocking inline code execution and requiring Subresource Integrity on all external assets.

## Primary User Journey
A developer (or CI pipeline) runs `npm run check:security` from `frontend/` and sees an exit-0 green pass confirming:
- No inline `<style>` tags in the deployed HTML
- No inline `<script>` content in the deployed HTML
- Every external script/stylesheet in `dist/index.html` carries an `integrity="sha384-..."` attribute and `crossorigin="anonymous"`
- All five required security response headers are declared in the deploy config (`_headers`)
- The CSP value contains `script-src 'self'` and does **not** contain `unsafe-inline`

Injecting `<script>alert(1)</script>` into `dist/index.html` must cause the script to exit 1 with a descriptive failure message.

## HTML Element Contract (dist/index.html)
The fixture HTML represents the deployed temperature-converter page:

| Element | Role |
|---------|------|
| `<link rel="stylesheet" href="..." integrity="sha384-..." crossorigin="anonymous">` | External stylesheet with SRI |
| `<script src="..." integrity="sha384-..." crossorigin="anonymous">` | External bundle with SRI |
| No `<style>` tags | CSP `style-src 'self'` compliance |
| No inline script content | CSP `script-src 'self'` compliance |

## Security Headers Contract (_headers)
Five required headers asserted by `checkSecurityHeaders`:

| Header | Required value |
|--------|---------------|
| `Content-Security-Policy` | Must contain `script-src 'self'` and must NOT contain `unsafe-inline` |
| `X-Frame-Options` | Present |
| `X-Content-Type-Options` | Present |
| `Referrer-Policy` | Present |
| `Permissions-Policy` | Present |

## Requirements

### Script Checks (Acceptance Criteria)
| Check | Expected |
|-------|----------|
| `checkNoInlineStyles(html)` | Throws if any `<style>` tag found; passes on clean HTML |
| `checkNoInlineScripts(html)` | Throws if any `<script>` has non-empty text content; passes for src-only scripts |
| `checkSRI(html)` | Throws if any `<script src>` or `<link rel="stylesheet" href>` is missing `integrity="sha384-..."` or `crossorigin="anonymous"` |
| `checkSecurityHeaders(content)` | Throws if any of the 5 required header names is absent from the deploy config |
| `checkCSP(content)` | Throws if CSP missing `script-src 'self'` or contains `unsafe-inline` |
| Full run (`node scripts/check-security.js`) | Exit 0 on clean fixture; exit 1 on injected inline script |

### Environment
- Node.js 20+ (available in CI Docker image)
- `jsdom` already in devDependencies — used for HTML parsing
- `npm run check:security` added to `frontend/package.json`
- Vitest tests in `frontend/test/check-security.test.ts`; run via `npm test`

### Security
Demo-mode / local-only. The script itself is a pure static analyser — no network calls, no authentication.

### Observability
N/A — this is a static analysis script. Exit codes and stdout messages are the observability signal.

## Success Criteria
- [x] `frontend/scripts/check-security.js` exists and exports all five check functions
- [x] `frontend/dist/index.html` exists as a compliant security fixture
- [x] `frontend/_headers` exists with all five required security response headers
- [x] `"check:security"` script added to `frontend/package.json`
- [x] `npm run check:security` exits 0 on the clean fixture
- [x] Injecting `<script>alert(1)</script>` into `dist/index.html` causes exit 1
- [x] All vitest tests in `test/check-security.test.ts` pass
- [x] No existing tests broken (`convert.test.ts`, `dom.test.ts`, `example.test.tsx` still pass)

## Known Limitations
None identified at contract-creation time. Will be updated if any are discovered during implementation.
