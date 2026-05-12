## Iteration 3 — Backend Reliability: harden test helpers against comment false-positives and missing-file failures

- Critique:
  (a) All three regex helpers (`resolveVar`, `resolveValue`, `propertyHasValue`) operated directly on the raw CSS source, including `/* … */` block comment text. A CSS comment containing a property-value pattern — e.g. `/* fallback: max-width: 300px */` — would be matched by `propertyHasValue`, producing a false-positive and allowing a genuine rule deletion to go undetected. The current stylesheet already contains comment text such as `/* 16 px × 2 = 32 px total gap */` and `/* minimum anywhere in the card */` adjacent to property declarations; any future comment with a colon would be at risk.
  (b) `beforeAll` called `readFileSync` with no guard. If `src/styles.css` is deleted or the path drifts, every downstream test fails with a cryptic `TypeError: Cannot read properties of undefined (reading 'match')` rather than a clear "file not found" message.
  (c) `propertyHasValue` had no word-boundary protection: a search for `"width"` would match inside `max-width` or `min-width` declarations. Although this did not cause failures in the current property set (callers always pass the full `min-height`, `min-width`, `max-width`, `font-size`, `margin-left` names), it was a latent over-match risk.
  (d) `resolveVar` used `.replace("--", "\\-\\-")` which only replaces the first occurrence of `"--"` and produces unnecessarily escaped (but functionally equivalent) regex fragments; fixed to use the regex form `.replace(/^--/, "\\-\\-")` to anchor correctly to the leading `--`.

- Change:
  (a) Added a `cssStripped` variable computed once in `beforeAll` by stripping all `/* … */` block comments via `/\/\*[\s\S]*?\*\//g`. All helpers (`resolveVar`, `propertyHasValue`) and all inline test assertions that reference the CSS source were updated to use `cssStripped` instead of `css` (`css` is retained only for the "file exists" test which reads from disk directly).
  (b) Added an `existsSync` pre-check in `beforeAll` that throws with a human-readable message naming the expected path, so CI logs immediately show the root cause.
  (c) Added a negative look-behind `(?<![a-z-])` to `propertyHasValue`'s regex, preventing partial-word matches against property names that are suffixes of longer names.
  (d) Fixed `resolveVar`'s `varName.replace("--", …)` to `varName.replace(/^--/, …)` so it anchors to the leading `--` only.

- Files touched: frontend/test/styles.test.ts, PRODUCT_ACCEPTANCE.md
- Tests: 13 vitest passed / 0 failed (before and after identical count — no test logic removed, reliability improved); 2 pytest passed / 0 failed

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
