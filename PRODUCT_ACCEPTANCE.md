# Product Acceptance Contract — Issue #11
# Accessibility: Debounced Screen-Reader Live Regions (400 ms idle window)

## Product Archetype

Accessibility enhancement for the temperature-converter single-page app. Adds debounced
ARIA live-region announcements so screen-reader users hear converted values only when the
user has stopped typing, not on every keystroke.

## Primary User Journey

1. User opens the temperature converter in a browser.
2. User types a Celsius value (e.g. "1", "10", "100" — three keystrokes).
3. While typing, the visible output rows update **immediately** after each keystroke.
4. The two SR-only live regions (`#sr-result`, `#sr-error`) remain **silent** during rapid typing.
5. After 400 ms of no further input, the screen reader announces either:
   - The Fahrenheit and Kelvin values (valid input), or
   - The error message (invalid input), or
   - Nothing (empty or pending input, both regions cleared).

## DOM Requirements

| Requirement | Status |
|---|---|
| `<div id="sr-result" aria-live="polite" aria-atomic="true" class="sr-only">` in `index.html` | [x] |
| `<div id="sr-error" aria-live="assertive" aria-atomic="true" class="sr-only">` in `index.html` | [x] |
| Both elements are empty on page load | [x] |

## CSS Requirements

| Requirement | Status |
|---|---|
| `.sr-only` uses `position: absolute` + `clip-path` (not `display:none`) | [x] |
| `.sr-only` sets `width: 1px`, `height: 1px`, `overflow: hidden` | [x] |
| `.sr-only` sets `white-space: nowrap` (prevents reading in fragments) | [x] |

## Logic Requirements (`src/main.ts` / `src/announcer.ts`)

| Requirement | Status |
|---|---|
| Each `input` event cancels any pending announcement `setTimeout` | [x] |
| After 400 ms idle: `valid` → `srResult.textContent = '<F> and <K>'`; `srError.textContent = ''` | [x] |
| After 400 ms idle: `invalid` → `srError.textContent = <msg>`; `srResult.textContent = ''` | [x] |
| After 400 ms idle: `empty`/`pending` → clear both regions | [x] |
| Visible output rows update **immediately** (sync with input event) | [x] |
| Live-region elements NOT updated on every keystroke | [x] |

## Acceptance Test Scenarios

| Scenario | Expected |
|---|---|
| Typing 5 characters at 50 ms intervals | Both SR regions still empty at 250 ms |
| 400 ms after last keystroke with valid input | `#sr-result` has F+K text; `#sr-error` empty |
| 400 ms after last keystroke with invalid format | `#sr-error` has error text; `#sr-result` empty |
| 400 ms after last keystroke with empty input | Both regions empty |
| 400 ms after last keystroke with pending input (e.g. "-") | Both regions empty |
| Second keystroke at 200 ms resets timer; result fires at 600 ms, not 400 ms | Only second content announced |
| `cancel()` called before timeout | No announcement fires |

## Security Posture

Demo/offline mode. No authentication required. SR live regions only expose computed
conversion results — no user input is echoed back verbatim.

## Observability

No additional observability hooks required for this issue (pure frontend accessibility fix).

## Success Criteria

- [x] All SR DOM structure tests pass (2+ assertions)
- [x] All `.sr-only` CSS tests pass (3+ assertions)
- [x] All debounce behavior tests pass (7+ assertions)
- [x] Typing 5 characters rapidly leaves both live regions silent until 400 ms after last keystroke
- [x] `npm test` exits 0 (all tests including pre-existing 25)
- [x] `check:types` exits 0
- [x] No existing tests broken

## Known Limitations

- The valid SR announcement format was enhanced beyond the original spec to include the
  source Celsius value ("100.00 °C = 212.00 °F and 373.15 K" rather than just
  "212.00 °F and 373.15 K"). This is an intentional UX improvement (Iteration 2) so
  screen-reader users receive a self-contained message without needing to remember what
  they typed.
- The app has no backend or server-sent content; live regions are populated entirely by
  client-side JavaScript. If JavaScript is disabled, the SR regions will never be
  populated (no progressive-enhancement fallback exists for the conversion output).
- The 400 ms idle window is hardcoded. Users who prefer a shorter or longer debounce
  (e.g. via `prefers-reduced-motion` or a future user preference) cannot adjust it.
