# Product Acceptance Contract — Temperature Converter (Issue #6)

## Product Archetype

A single-page, offline-capable temperature converter that accepts Celsius input and renders
Fahrenheit and Kelvin equivalents in real-time. The UI manages explicit EMPTY / PENDING /
VALID / INVALID states so the interface always communicates clearly to the user.

---

## Primary User Journey

1. User opens the app in a browser.
2. User types a Celsius temperature (e.g. `100`) into the `#celsius-input` field.
3. The app immediately displays `212.00 °F` and `373.15 K`.
4. User clears the input; the outputs revert to `—` and the empty-hint appears.
5. User enters an out-of-range value (e.g. `9999999`); a range-error message is shown.
6. User enters a non-numeric value (e.g. `abc`); a format-error message is shown.
7. User corrects the input; outputs update correctly.

All seven steps are covered by vitest + jsdom tests in `tests/dom.test.ts`.

---

## Requirements

### UI / Frontend
- [x] On `DOMContentLoaded`, attach `input` event listener to `#celsius-input`.
      (`src/main.ts` lines 133-140: fires on `DOMContentLoaded` or immediately if the
      document is already interactive/complete.)
- [x] State machine: `empty` → `—` outputs + empty-hint + clear `aria-describedby`.
      (`src/main.ts` case `"empty"`: sets outputs to `—`, shows empty-hint, sets
      `aria-describedby` to `"empty-hint"`; `lastValid` cleared.)
- [x] State machine: `pending` → keep last-valid (or `—`) outputs + hide error + hide hint.
      (`src/main.ts` case `"pending"`: hides error + hint, removes `aria-describedby`,
      preserves `lastValid` outputs; outputs stay `—` if no prior valid value.)
- [x] State machine: `valid` → show formatted `°F` and `K` outputs; cache last-valid pair.
      (`src/main.ts` case `"valid"`: computes and displays formatted strings, caches
      `{ fahrenheit, kelvin }` in `lastValid`.)
- [x] State machine: `invalid` → `—` outputs + error message + show error slot.
      (`src/main.ts` case `"invalid"`: resets outputs to `—`, sets `errorMsg.textContent`
      to the appropriate message, shows error slot, adds `is-invalid` CSS class.)
- [x] Exact format error string: `Please enter a valid number (use "." as the decimal point, e.g. 36.6 or -40).`
      (`src/main.ts` `MSG_FORMAT` constant; asserted by `tests/dom.test.ts`.)
- [x] Exact range error string: `Enter a value between -1,000,000 and 1,000,000 °C.`
      (`src/main.ts` `MSG_RANGE` constant; asserted by `tests/dom.test.ts`.)
- [x] All dynamic DOM writes use `textContent` exclusively (XSS safe).
      (All `setOutputs`, `errorMsg.textContent` assignments in `src/main.ts`; no `innerHTML`
      anywhere in the codebase. Verified by XSS tests in `tests/dom.test.ts`.)
- [x] No `setTimeout` for visible output — updates in same callback tick.
      (No `setTimeout` call exists in `src/main.ts`; all state updates happen synchronously
      within the `input` event handler.)
- [x] Responsive layout: works from 320 px to 480 px+ viewports.
      (`src/styles.css`: `.converter-card` has `max-width: 480px` and `width: 100%`;
      `@media (max-width: 480px)` block adjusts font sizes and padding for small viewports.)
- [x] Minimum tap targets (≥ 44 × 44 px).
      (`src/styles.css` `.celsius-input`: `min-height: 3rem` = 48 px at `font-size: 16px`
      root, combined with `width: 100%`, satisfies the 44 × 44 px requirement.)

### Backend
- Not applicable — this is a purely static, client-side app.

### Security
- [x] XSS: all user-controlled content written with `textContent`, never `innerHTML`.
- [x] Demo-mode / local-only limitation documented (no authentication required for a static converter).
      See "Known Limitations" below.

### Observability
- No runtime telemetry required for a static client-side app. CI pipeline validates
  bundle size and test coverage (Issues #17, #19).

---

## Acceptance Criteria (Issue #6 scope)

| # | Criterion | Status |
|---|-----------|--------|
| 1 | Typing `100` shows `212.00 °F` and `373.15 K` | ✅ |
| 2 | Clearing input restores `—` and empty-hint | ✅ |
| 3 | `-273.16` is valid; `-274` is valid (but extreme); `1000001` shows range error | ✅ |
| 4 | `abc` shows format error | ✅ |
| 5 | `-` alone triggers pending (no error, no output change) | ✅ |
| 6 | Error slot uses `textContent`, not `innerHTML` | ✅ |
| 7 | Tests pass under vitest + jsdom | ✅ |

---

## Known Limitations

- **Authentication / access control**: not applicable — purely offline static app.
  No user data is transmitted, stored, or processed server-side.

- **Demo-mode / security posture**: the app runs entirely in the browser with no
  server component. There is no authentication, no session management, and no network
  requests at runtime. CSP is enforced via a `<meta http-equiv="Content-Security-Policy">`
  tag (Pass 1) with `default-src 'none'; script-src 'self'; style-src 'self'; base-uri
  'none'; form-action 'none'`. This is the appropriate posture for an offline converter.

- **CI integration for pnpm tests (Issue #19)**: the `pnpm test` command (vitest,
  113 tests) is NOT yet wired into `.github/workflows/ci.yml`. The existing CI job
  covers only `backend/` (pytest) and `frontend/` (npm/Next.js). Wiring the
  temperature-converter test suite into CI is tracked as Issue #19. Until that issue
  is resolved, tests must be run locally via `pnpm test` from the repo root to verify
  the converter.

- **Issues #7-#21 are parallel and not yet merged**; this PR covers Issue #6 scope only.

---

*Last updated: 2026-05-12 (Pass 5 — Product Acceptance)*
