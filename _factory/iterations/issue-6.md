## Pass 1 — Security Hardening: Add Content-Security-Policy meta tag

**Finding:** `src/index.html` had no Content-Security-Policy declaration. The JS code
correctly uses `textContent` everywhere (no XSS via DOM writes), there are no inline event
handlers, no `as any` casts, no `JSON.parse` on user input, and no prototype-pollution
surface. The sole gap was the absence of a browser-enforced CSP — without it, any future
accidental `innerHTML` write or injected `<script>` tag would execute unchecked. A strict
meta-tag CSP provides defense-in-depth at the browser level.

**Change:** Added a `<meta http-equiv="Content-Security-Policy">` tag to `src/index.html`
with the maximally restrictive policy appropriate for a purely static, single-origin app:
`default-src 'none'; script-src 'self'; style-src 'self'; base-uri 'none'; form-action 'none'`.
This blocks all inline scripts, all external resource loads, base-tag hijacking, and form
exfiltration while permitting only the same-origin ES module bundle and stylesheet.

**Files touched:** `src/index.html`

**Tests:** pnpm test → 31 passed (unchanged)
