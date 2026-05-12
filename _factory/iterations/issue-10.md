## Iteration 1 — Security Hardening: remove window.setInputAriaError global

- Critique: `src/main.ts` attached a DOM-manipulation function to `window.setInputAriaError`. This global is callable by any script on the page — including browser extensions, future XSS payloads, or prototype-pollution exploits. The function toggled `hidden` on `#celsius-error` and called `errorEl.textContent = ''`, meaning an attacker-controlled script could silently suppress real validation errors (clearing the error element and hiding it) or reveal the error slot at will. Exposing a DOM-manipulation handle on `window` also violates the project's stated CSP-friendly posture ("No inline scripts or styles") by creating an uncontrolled side-channel between unrelated script units.

- Change: Replaced the `window.setInputAriaError = ...` assignment with a `document.addEventListener('celsius-error', ...)` CustomEvent listener. The validation layer (issue #7) dispatches `new CustomEvent('celsius-error', { detail: { hasError: boolean, message?: string } })` on `document` — a well-scoped DOM event. This removes the `window`-level handle entirely (the `WindowWithHelper` type augmentation is also gone). Added `tests/security.test.ts` with 3 tests that verify: (a) the source does not assign to `window.setInputAriaError`, (b) the `WindowWithHelper` type bridge is gone, and (c) the CustomEvent listener is registered on `document`.

- Files touched:
  - `src/main.ts` — removed `window.setInputAriaError` global, added `document.addEventListener('celsius-error', ...)` handler
  - `tests/security.test.ts` — new file, 3 source-level security assertions

- Tests: 19 passed before → 22 passed after (3 new security tests added, 0 failures)

## Iteration 2 — UX/Product Polish: aria-pressed on #sign-toggle tracks negative-sign state

- Critique: `#sign-toggle` is a stateful toggle button (pressing it flips the input between positive and negative), but it carried no `aria-pressed` attribute. Without `aria-pressed`, screen readers announce only the button label — "Toggle negative sign" — and never tell the user whether the negative sign is currently active. A blind user who presses the button twice without moving focus has no reliable way to know whether they are back to a positive value. This is a genuine interaction-state gap: WAI-ARIA 1.1 §6.6.4 defines `aria-pressed` exactly for toggle buttons, and its absence here violates the pattern. The `±` glyph alone conveys no state whatsoever to assistive technology.

- Change: Added `aria-pressed="false"` to the initial `<button>` element in `index.html`. Exported a new pure helper `syncSignTogglePressed(button, inputValue)` from `src/main.ts` that sets `aria-pressed="true"` when the input value begins with `"-"` and `"false"` otherwise. The `initDom()` click handler now calls `syncSignTogglePressed` after each toggle so the button immediately reports its new pressed state. An `input` event listener on `#celsius-input` also calls `syncSignTogglePressed` so that manual edits (typing or deleting a minus sign) keep `aria-pressed` consistent. Five new tests in `tests/a11y.test.ts` cover: initial HTML attribute presence, initial value of `"false"`, and all three branches of `syncSignTogglePressed` (negative value, positive value, empty string).

- Files touched:
  - `index.html` — added `aria-pressed="false"` to `#sign-toggle`
  - `src/main.ts` — exported `syncSignTogglePressed`, called in click and input handlers
  - `tests/a11y.test.ts` — 5 new tests for aria-pressed initial state and JS sync

- Tests: 22 passed before → 27 passed after (5 new aria-pressed tests added, 0 failures)

## Iteration 3 — Backend Reliability: defensive guards for CustomEvent detail and toggleSign whitespace

- Critique: Two robustness gaps existed in `src/main.ts`. (1) The `celsius-error` CustomEvent listener destructured `evt.detail` without guarding against `null` or `undefined` detail — if any caller dispatches `new CustomEvent('celsius-error')` without a `detail` object (or with `{ detail: null }`), the destructuring throws a TypeError inside the event callback. Because event-listener exceptions are swallowed by the browser, this leaves the ARIA error state permanently stale with no visible failure signal: screen-reader users lose all error announcements silently. (2) `toggleSign` did not trim its input before inspection, so whitespace-only strings like `'   '` produced `'-   '` rather than `'-'`, and a value like `-  42  ` produced `  42` (outer whitespace stripped but interior gap preserved after sign removal). In a numeric input field these are minor but real edge cases that can corrupt conversion output.

- Change: In the `celsius-error` listener, added an explicit guard that returns early when `detail` is `null`, `undefined`, or not an object — preventing the TypeError crash. Replaced the cast-and-destructure pattern with a two-step approach: extract `detail` as `unknown`, type-check it, then cast to a partial type for property access. The `hasError` check uses strict equality (`=== true`) so a missing or non-boolean `hasError` key is treated as no-error rather than silently trusting a falsy cast. In `toggleSign`, added `currentValue.trim()` before any logic so whitespace-only values are treated identically to the empty string and outer whitespace is stripped from all inputs before sign manipulation. Added `tests/reliability.test.ts` with 9 tests covering both fixes: five `toggleSign` whitespace variants and four source-level assertions confirming the defensive guard pattern is present in `main.ts`.

- Files touched:
  - `src/main.ts` — null/undefined/non-object guard in `celsius-error` listener; `=== true` strict-equality for `hasError`; `trim()` in `toggleSign`
  - `tests/reliability.test.ts` — new file, 9 reliability/edge-case tests

- Tests: 27 passed before → 36 passed after (9 new reliability tests added, 0 failures)

## Iteration 4 — Test and Evaluation Coverage: end-to-end DOM tests, 2px outline width assertions, syncSignTogglePressed edge cases, and <dl> structure tests

- Critique: Four coverage gaps existed in `tests/a11y.test.ts`. (1) All `setInputAriaError` and `syncSignTogglePressed` tests used stub objects (`{ setAttribute: ... }`) rather than real JSDOM `HTMLInputElement` and `HTMLButtonElement` instances — meaning the tests never exercised the actual DOM API path that runs in the browser, only a duck-typed shim. A bug in `setAttribute` call signature or property access would be invisible to these stubs. (2) The CSS `:focus-visible` tests verified only that an `outline:` declaration existed (or a `box-shadow`), but never parsed the width value. The actual PRODUCT_ACCEPTANCE.md requirement is "minimum 2px solid" — a value of `outline: 1px dashed red` would have passed the old test. (3) `syncSignTogglePressed` was tested for `'-42'`, `'42'`, and `''` but not for the boundary cases `-` (sign-only), `-0`, and `--5` — the first of which is the direct output of `toggleSign('')` and the state a user is in after clicking the toggle on an empty field. (4) The `<dl>` output structure with paired `<dt>`/`<dd>` elements — the PRODUCT_ACCEPTANCE.md requirement "Output `<dd>` rows have accessible names from their visible `<dt>` labels" — had zero test coverage; the `#fahrenheit-output` and `#kelvin-output` elements were never verified as being `<dd>` tags inside a `<dl>` with adjacent `<dt>` text.

- Change: Added 14 new tests across four new `describe` blocks appended to `tests/a11y.test.ts`. (1) "ARIA helpers — end-to-end with real JSDOM elements": 4 tests that create fresh JSDOM fragments, obtain real `HTMLInputElement` / `HTMLButtonElement` instances from `dom.window.document.getElementById`, and call `setInputAriaError` / `syncSignTogglePressed` against them — exercising the actual DOM `setAttribute`/`getAttribute` path. (2) "CSS focus styles — 2px minimum outline width": 2 tests that extract the numeric pixel value from the `outline:` declaration and assert `>= 2`, so any future weakening of the outline is caught. (3) "#sign-toggle aria-pressed — edge cases for syncSignTogglePressed": 3 tests for `-`, `-0`, and `--5` — all start with `-` and must produce `aria-pressed="true"`. (4) "output `<dl>` structure — accessible `<dt>`/`<dd>` pairing": 5 tests verifying the `<dl>` exists, `#fahrenheit-output` and `#kelvin-output` are `<DD>` elements inside it, and each has a sibling `<dt>` containing the word "Fahrenheit" / "Kelvin". Also ticked all previously-passing-but-unchecked PRODUCT_ACCEPTANCE.md checkboxes (all requirements were already implemented in earlier iterations; tests now explicitly verify each one).

- Files touched:
  - `tests/a11y.test.ts` — 14 new tests in 4 new describe blocks; updated top comment
  - `PRODUCT_ACCEPTANCE.md` — ticked 13 checkboxes (ARIA, focus styles, tab order, structure, success criteria — all except colour contrast which requires manual measurement)

- Tests: 36 passed before → 50 passed after (14 new tests added, 0 failures)
