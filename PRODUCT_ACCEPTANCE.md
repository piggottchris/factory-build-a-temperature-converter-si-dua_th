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

---

## Requirements

### UI / Frontend
- [ ] On `DOMContentLoaded`, attach `input` event listener to `#celsius-input`.
- [ ] State machine: `empty` → `—` outputs + empty-hint + clear `aria-describedby`.
- [ ] State machine: `pending` → keep last-valid (or `—`) outputs + hide error + hide hint.
- [ ] State machine: `valid` → show formatted `°F` and `K` outputs; cache last-valid pair.
- [ ] State machine: `invalid` → `—` outputs + error message + show error slot.
- [ ] Exact format error string: `Please enter a valid number (use "." as the decimal point, e.g. 36.6 or -40).`
- [ ] Exact range error string: `Enter a value between -1,000,000 and 1,000,000 °C.`
- [ ] All dynamic DOM writes use `textContent` exclusively (XSS safe).
- [ ] No `setTimeout` for visible output — updates in same callback tick.
- [ ] Responsive layout: works from 320 px to 480 px+ viewports.
- [ ] Minimum tap targets (≥ 44 × 44 px).

### Backend
- Not applicable — this is a purely static, client-side app.

### Security
- [x] XSS: all user-controlled content written with `textContent`, never `innerHTML`.
- [ ] Demo-mode / local-only limitation documented (no authentication required for a static converter).

### Observability
- No runtime telemetry required for a static client-side app. CI pipeline validates
  bundle size and test coverage (Issues #17, #19).

---

## Acceptance Criteria (Issue #6 scope)

| # | Criterion | Status |
|---|-----------|--------|
| 1 | Typing `100` shows `212.00 °F` and `373.15 K` | ⬜ |
| 2 | Clearing input restores `—` and empty-hint | ⬜ |
| 3 | `-273.16` is valid; `-274` is valid (but extreme); `1000001` shows range error | ⬜ |
| 4 | `abc` shows format error | ⬜ |
| 5 | `-` alone triggers pending (no error, no output change) | ⬜ |
| 6 | Error slot uses `textContent`, not `innerHTML` | ⬜ |
| 7 | Tests pass under vitest + jsdom | ⬜ |

---

## Known Limitations

- Authentication / access control: not applicable (static offline app).
- Issues #7-#21 are parallel and not yet merged; this PR covers Issue #6 scope only.

---

*Last updated: 2026-05-12 (initial creation)*
