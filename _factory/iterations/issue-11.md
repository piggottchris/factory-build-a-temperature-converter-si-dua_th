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

## Iteration 4 — Test and Evaluation Coverage: announcer boundary cases + HTML structural regression guards

- Critique: The existing 58 tests had several real coverage gaps:

  1. `createAnnouncer()` (no-arg, default 400 ms) was never called without an explicit
     argument — only `createAnnouncer(400)` was used. If the default parameter were
     accidentally removed, no test would fail.

  2. `delayMs = 0` was untested. The implementation uses `setTimeout(..., 0)` which is
     still async (fires on next tick, not inline). Without a test the boundary between
     synchronous and deferred behaviour was undocumented and unguarded.

  3. `cancel()` called when `timerId` is null (no pending timer) was untested. The guard
     `if (timerId !== null)` made it a no-op, but there was no regression test — a future
     refactor that removed the null-guard would silently throw `clearTimeout(null)` in
     some runtimes.

  4. `cancel()` called twice in a row (double-cancel) was untested for the same reason.

  5. Multiple `schedule()` calls at zero time interval (no `advanceTimersByTime` between
     them) were untested. The existing "5 rapid keystrokes" test advanced by 50 ms
     between each call; a purely synchronous multi-call scenario was not covered.

  6. `schedule()` after `cancel()` (restart after explicit teardown) was untested.

  7. The CSS test checked only for presence of `clip-path` in `.sr-only`, not the
     specific value `inset(50%)`. Any other value (e.g. `rect(0 0 0 0)`) would pass the
     existing test but deliver incorrect clipping behaviour for AT.

  8. No test guarded the element tag-name of `#sr-result` / `#sr-error`. A refactor
     changing them from `<div>` to `<p>` or `<span>` could subtly affect how some screen
     readers handle the live region (especially `<p>` which implies paragraph semantics).

  9. No test asserted that `#sr-result` / `#sr-error` lack a `hidden` attribute. Adding
     `hidden` to a live region silences it in all major AT — an easy accidental regression.

- Change: Added 11 new test assertions across two files:

  In `tests/a11y.test.ts`:
  - New `.sr-only clip-path value is exactly inset(50%)` assertion inside the existing
    `.sr-only in src/styles.css` describe block (1 test).
  - New `createAnnouncer — boundary and edge cases` describe block (6 tests):
    - `createAnnouncer()` with no argument uses 400 ms default
    - `createAnnouncer(0)` fires on the next tick (via `advanceTimersByTime(0)`)
    - `cancel()` with no pending timer does not throw
    - `cancel()` after a prior `cancel()` does not throw
    - Multiple `schedule()` calls at the same instant only fires the last one
    - `schedule()` after `cancel()` restarts the timer correctly

  In `tests/html-structure.test.ts`:
  - New `SR live-region element structure regression guards` describe block (4 tests):
    - `#sr-result` is a `<div>` element
    - `#sr-error` is a `<div>` element
    - `#sr-result` does not have a `hidden` attribute
    - `#sr-error` does not have a `hidden` attribute

- Files touched:
  - tests/a11y.test.ts
  - tests/html-structure.test.ts
  - _factory/iterations/issue-11.md (this file)

- Tests: 58 passed before → 69 passed after (11 new assertions, all green; `check:types` exits 0).
