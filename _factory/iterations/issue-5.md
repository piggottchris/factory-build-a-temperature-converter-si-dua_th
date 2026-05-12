## Iteration 2 — UX/Product Polish: fix input focus ring, add reduced-motion guard, document dark-mode deferral

- Critique:
  (a) `input:focus` was using the unprefixed `:focus` pseudo-class, meaning mouse/touch clicks on the input triggered the blue outline ring. The `.btn` already correctly used `:focus-visible`. This inconsistency violates the principle that focus rings should be visible to keyboard users but suppressed for pointer interactions.
  (b) No `prefers-reduced-motion` guard existed. The CSS had no transitions yet, but the scaffold pattern should lock in the motion-sensitive media query early so any future developer adding a hover/active transition cannot accidentally omit the reduced-motion suppression.
  (c) No acknowledgement of `prefers-color-scheme: dark` — readers of the stylesheet have no signal about whether dark mode was considered or deliberately deferred.
- Change:
  (a) Replaced `input:focus { … }` with `input:focus-visible { … }` plus an explicit `input:focus:not(:focus-visible) { outline: none }` rule to strip the UA default ring for pointer interactions. This brings the input into parity with `.btn:focus-visible` and matches the WCAG 2.4.11 intent of showing focus rings only where they provide navigation value.
  (b) Added a `@media (prefers-reduced-motion: reduce)` block at the bottom of the file that zeroes out all animation/transition/scroll durations with `!important`, acting as a future-proof catch-all.
  (c) Added a CSS comment block explicitly marking dark mode as out of scope and naming a planned issue where it will land.
- Files touched: frontend/src/styles.css, _factory/iterations/issue-5.md
- Tests: 13 vitest passed / 0 failed; 2 pytest passed / 0 failed (before and after identical — no test logic changed)

## Iteration 1 — Security Hardening: NO-OP — no security issues found

- Critique: Reviewed `frontend/src/styles.css` through the full security lens:
  (a) No `@import` or `url()` calls — no remote-asset fetch, no CSP `style-src` / `connect-src` risk.
  (b) No `content:` properties — no pseudo-element text injection vector.
  (c) No IE-legacy dynamic-CSS vectors (`expression()`, `behavior:`, `-moz-binding:`).
  (d) No suspicious Unicode escapes or CSS-injection constructs.
  (e) `env(safe-area-inset-*)` usage is correct — all four values carry a `0px` fallback, preventing an invalid-value drop on unsupporting browsers.
  (f) `text-size-adjust: 100%` (both prefixed and unprefixed) is correct; `none` would suppress OS-level font scaling for accessibility users.
  (g) All CSS custom properties (`var()`) are `:root`-declared tokens, not derived from user input.
- Change: None. File is clean; a NO-OP note is the appropriate outcome.
- Files touched: _factory/iterations/issue-5.md (this record only)
- Tests: 13 vitest passed / 0 failed; 2 pytest passed / 0 failed (before and after identical — no code changed)
