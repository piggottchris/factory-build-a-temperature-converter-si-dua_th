## Iteration 1 — Security Hardening: add Content-Security-Policy meta tag

- Critique: The HTML had no Content-Security-Policy header or meta tag. Without one the
  browser applies no restrictions on script sources, framing, or connection targets, leaving
  the page open to injected-script XSS and clickjacking. The rest of the security posture
  was already solid: every DOM write uses `textContent` (never `innerHTML`), error messages
  are hardcoded literals (user input is never echoed verbatim into the DOM), no inline
  event handlers or data URIs exist, and the SR live regions are CSP-friendly `<div>`
  elements. The missing CSP was the single remaining actionable gap.

- Change: Added `<meta http-equiv="Content-Security-Policy">` to `index.html` with a
  strict policy: `default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self';
  connect-src 'none'; frame-ancestors 'none'`. This allows only same-origin scripts and
  stylesheets, blocks all network requests (the app is fully offline), and prevents
  the page from being embedded in iframes (clickjacking defence). Added 4 new vitest
  assertions in `tests/html-structure.test.ts` to enforce the CSP stays present and
  correct in future changes.

- Files touched:
  - index.html
  - tests/html-structure.test.ts
  - _factory/iterations/issue-11.md (this file)

- Tests: 50 passed before → 54 passed after (4 new CSP assertions added, all green).
