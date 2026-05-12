# Product Acceptance Contract — Issue #12

## Feature
`tests/dom.test.ts`: jsdom DOM state-transition tests for the temperature-converter UI (`lib/main.ts`).

## Product Archetype
Developer tooling / DOM integration test layer for the temperature-converter POC. These tests verify that the vanilla-TS DOM controller (`lib/main.ts`) correctly drives the page's HTML elements through every user-visible state.

## Primary User Journey
A developer runs `npm test` from `frontend/` and sees a green suite (covering both `convert.test.ts` and `dom.test.ts`) that confirms the UI controller handles:
- Initial/empty state (hint visible, outputs `—`, no error)
- Valid Celsius input (correct Fahrenheit/Kelvin outputs, no error)
- Invalid format input (error visible with exact message, outputs `—`)
- Out-of-range input (range error visible, outputs `—`)
- Valid → invalid transition (context "was:" line visible with last result)
- Clearing after error (error hidden, hint restored, context hidden)
- Pending inputs (no error flashed, outputs frozen)
- ± sign-toggle button (toggles sign, re-renders outputs)

## HTML Element Contract

| Element ID | Role |
|------------|------|
| `#celsius-input` | Text input — user enters a Celsius value |
| `#sign-toggle` | Button — toggles the ± sign on the current input |
| `#empty-hint` | Paragraph — visible only in EMPTY state |
| `#helper-text` | Paragraph — always visible; instructional copy |
| `#error-slot` | Paragraph — visible only when parse returns INVALID |
| `#fahrenheit-output` | Paragraph — Fahrenheit result or `—` |
| `#kelvin-output` | Paragraph — Kelvin result or `—` |
| `#context-line` | Paragraph — visible only when INVALID + previous valid exists |

## Error & Copy Strings (PRD verbatim)

| String key | Exact text |
|------------|-----------|
| `FORMAT_ERROR_MSG` | `Invalid format — only decimal numbers are accepted (e.g. -23.5).` |
| `RANGE_ERROR_MSG` | `Out of range — enter a value between -1 000 000 and 1 000 000.` |
| Empty-hint | `Enter a temperature in Celsius` |
| Helper text | `Decimals and negatives OK. Use "." as the decimal point.` |
| Context line | `was: {fahrenheit} · {kelvin}` (e.g. `was: 212.00 °F · 373.15 K`) |

## Requirements

### Test Coverage (Acceptance Criteria)

#### State Transitions
| Scenario | Expected |
|----------|----------|
| Initial (empty input) | outputs `—`, error hidden, hint visible |
| Input `100` | `212.00 °F`, `373.15 K`, no error |
| Input `0` | `32.00 °F`, `273.15 K` |
| Input `-40` | `-40.00 °F`, `233.15 K` |
| Input `36.6` | `97.88 °F`, `309.75 K` |
| Input `abc` | error visible with FORMAT_ERROR_MSG, outputs `—` |
| Input `1500000` | error visible with RANGE_ERROR_MSG, outputs `—` |
| Input `100` then `abc` | context line visible: `was: 212.00 °F · 373.15 K` |
| Clear after error | error hidden, hint visible, outputs `—`, context hidden |
| Pending inputs (`-`, `.`, `-.`, `1.`) | error stays hidden, outputs unchanged |
| `±` with `36.6` | input becomes `-36.6`, outputs `-33.88 °F` / `236.55 K` |
| `±` with empty | no-op |

#### Static Text
| Element | Expected content |
|---------|-----------------|
| `#empty-hint` | `Enter a temperature in Celsius` |
| `#helper-text` | `Decimals and negatives OK. Use "." as the decimal point.` |

### Environment
- Vitest + jsdom (already configured in `vitest.config.ts`)
- Static import of `../lib/main` and `../lib/convert`
- `npm test` in `frontend/` must exit 0 (covers both test files)

### Security
Demo-mode / local-only. No authentication required. All validation is client-side in `lib/convert.ts`.

### Observability
N/A for a pure test PR — no runtime observability hooks.

## Success Criteria
- [ ] `frontend/lib/main.ts` exists and exports `init`, `FORMAT_ERROR_MSG`, `RANGE_ERROR_MSG`
- [ ] `frontend/tests/dom.test.ts` exists and covers all scenarios above
- [ ] All state-transition tests pass
- [ ] All static-text tests pass
- [ ] `npm test` exits 0 in `frontend/` (both test files green)
- [ ] No existing tests broken (`convert.test.ts` and `example.test.tsx` still pass)

## Known Limitations
_None at this time._
