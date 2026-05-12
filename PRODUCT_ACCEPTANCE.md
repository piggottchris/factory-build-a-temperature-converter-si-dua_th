# Product Acceptance Contract — Issue #13

## Feature
`tests/a11y.test.ts`: Vitest + jsdom + axe-core accessibility tests for the temperature
converter widget, covering zero-violation checks in all three input states and an
announcement-debounce assertion for screen-reader live regions.

## Product Archetype
Developer tooling / accessibility-test coverage layer for a temperature-converter POC
built on FastAPI + MAF + CopilotKit.

## Primary User Journey
A developer runs `pnpm test:a11y` (or `npm run test:a11y`) from `frontend/` and sees a
green suite confirming that:

- the temperature converter widget passes automated axe-core accessibility checks in all
  three meaningful states (EMPTY, VALID input, INVALID input),
- screen-reader live-region announcements are debounced so rapid keystrokes do NOT
  interrupt the user mid-typing, and
- the announcement fires exactly once, with the correct Fahrenheit + Kelvin values,
  after a 400 ms quiet period.

## Requirements

### Accessibility test coverage (acceptance criteria)

#### axe-core zero-violation checks
| State | Trigger | Expected |
|-------|---------|----------|
| EMPTY | No input | `axe(document)` → 0 violations |
| VALID | `input.value = '100'`, dispatch `input` | `axe(document)` → 0 violations |
| INVALID | `input.value = 'abc'`, dispatch `input` | `axe(document)` → 0 violations |

#### Announcement debounce assertion
| Step | Action | Expected |
|------|--------|----------|
| 1–5 | 5 rapid input events (< 400 ms apart each) | `#sr-result` and `#sr-error` both empty after each |
| 6 | Advance fake clock by 400 ms | `#sr-result` contains Fahrenheit and Kelvin values |

### Environment
- jsdom environment (already configured in vitest)
- `vi.useFakeTimers()` for debounce tests
- `axe-core` for DOM accessibility checks
- `pnpm test:a11y` must exit 0

### Widget requirements
- Accessible input with associated `<label>`
- `#sr-result` — ARIA live region for announcing valid conversions (polite)
- `#sr-error` — ARIA live region for announcing errors (assertive)
- `aria-invalid` toggled correctly in VALID vs INVALID states
- Error message connected to input via `aria-describedby`
- 400 ms debounce on SR region updates

### Security
Demo-mode / local-only. No authentication required.
Input validation is performed by the existing `parseTemperature` utility (max length 32,
range ±1 000 000, format allowlist).

### Observability
N/A for a pure test PR — no additional runtime observability hooks needed beyond what
is already in place.

## Success Criteria
- [ ] `pnpm test:a11y` (vitest `--project a11y` or `--reporter` filter) exits 0
- [ ] `axe-core` installed as a dev dependency
- [ ] `frontend/tests/a11y.test.ts` exists and covers the three axe states
- [ ] Debounce assertion uses `vi.useFakeTimers()` and 400 ms threshold
- [ ] `#sr-result` populated with Fahrenheit + Kelvin after debounce fires
- [ ] `frontend/lib/temperature-widget.ts` exists and is imported by the test
- [ ] Zero existing tests broken (`pnpm test` still green)
- [ ] No uv, no OpenAI, no @ai_function — all CLAUDE.md conventions respected

## Known Limitations
_None at this time._
