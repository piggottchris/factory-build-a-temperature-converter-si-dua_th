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

## Iteration 2 — UX/Product Polish: SR announcement includes source Celsius value

- Critique: The valid-result screen-reader announcement was `"212.00 °F and 373.15 K"`. A
  blind user who has typed into the input and waited 400 ms hears two numbers with no
  context — they must remember they entered Celsius and mentally reconstruct what the
  announcement refers to. The message was not self-contained. Contrast this with a sighted
  user who sees the labelled input field, the labelled result rows, and instantly knows
  which unit maps to which value. Screen-reader users deserved the same clarity.

- Change: Updated `src/main.ts` to assemble the valid SR announcement as
  `"<C> °C = <F> °F and <K> K"` (e.g. `"100.00 °C = 212.00 °F and 373.15 K"`). This
  includes the source value and unit so the message is completely self-contained.
  Added 4 new test assertions in `tests/a11y.test.ts` (new describe block
  "SR announcement message format") that verify: (a) the announcement contains `°C`,
  `°F`, and `K`; (b) the format matches `<number> °C = <number> °F`; (c) known values
  for 0 °C and 100 °C produce exact expected strings; (d) -40 °C (crossover point)
  contains the negative Celsius value. The two existing `check:types` errors in
  `tests/a11y.test.ts` (lines 147-148, `VitestUtils` vs `HookCleanupCallback`) are
  pre-existing and not introduced by this change.

- Files touched:
  - src/main.ts
  - tests/a11y.test.ts
  - _factory/iterations/issue-11.md (this file)

- Tests: 54 passed before → 58 passed after (4 new message-format assertions, all green).

## Iteration 3 — Backend Reliability: fix TypeScript compile errors in test hooks

- Critique: `npm run check:types` (tsc --noEmit) exited with 4 errors — all in
  `tests/a11y.test.ts`. The two `describe` blocks that test the debounced announcer used
  concise arrow syntax for `beforeEach`/`afterEach`:

    ```ts
    beforeEach(() => vi.useFakeTimers())
    afterEach(()  => vi.useRealTimers())
    ```

  Both `vi.useFakeTimers()` and `vi.useRealTimers()` return `VitestUtils` (the `vi`
  singleton). With Vitest 1.6.x the hook callback signature was tightened to
  `Awaitable<HookCleanupCallback | void>`. Because the arrow has no braces the return
  value of the expression is implicitly the return value of the callback, so TypeScript
  correctly flagged `VitestUtils` as non-assignable to the expected type. At runtime
  the code happened to work (Vitest ignores non-Promise, non-function return values), but
  the type errors meant `check:types` could never go green — a silent compile-time
  reliability gap that would mask future real errors in the same file.

- Change: Added block bodies `{ ... }` to all four arrow-function hooks in the two
  affected `describe` blocks inside `tests/a11y.test.ts`. With block bodies the arrows
  return `undefined` (i.e. `void`), which satisfies the hook callback constraint.
  No logic was changed; the fix is purely syntactic. `tsc --noEmit` now exits 0.

- Files touched:
  - tests/a11y.test.ts

- Tests: 58 passed before → 58 passed after (no regressions; `check:types` now exits 0).
