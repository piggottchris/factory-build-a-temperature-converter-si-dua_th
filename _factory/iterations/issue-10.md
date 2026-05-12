## Iteration 1 — Security Hardening: remove window.setInputAriaError global

- Critique: `src/main.ts` attached a DOM-manipulation function to `window.setInputAriaError`. This global is callable by any script on the page — including browser extensions, future XSS payloads, or prototype-pollution exploits. The function toggled `hidden` on `#celsius-error` and called `errorEl.textContent = ''`, meaning an attacker-controlled script could silently suppress real validation errors (clearing the error element and hiding it) or reveal the error slot at will. Exposing a DOM-manipulation handle on `window` also violates the project's stated CSP-friendly posture ("No inline scripts or styles") by creating an uncontrolled side-channel between unrelated script units.

- Change: Replaced the `window.setInputAriaError = ...` assignment with a `document.addEventListener('celsius-error', ...)` CustomEvent listener. The validation layer (issue #7) dispatches `new CustomEvent('celsius-error', { detail: { hasError: boolean, message?: string } })` on `document` — a well-scoped DOM event. This removes the `window`-level handle entirely (the `WindowWithHelper` type augmentation is also gone). Added `tests/security.test.ts` with 3 tests that verify: (a) the source does not assign to `window.setInputAriaError`, (b) the `WindowWithHelper` type bridge is gone, and (c) the CustomEvent listener is registered on `document`.

- Files touched:
  - `src/main.ts` — removed `window.setInputAriaError` global, added `document.addEventListener('celsius-error', ...)` handler
  - `tests/security.test.ts` — new file, 3 source-level security assertions

- Tests: 19 passed before → 22 passed after (3 new security tests added, 0 failures)
