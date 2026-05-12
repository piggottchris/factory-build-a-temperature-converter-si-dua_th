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
