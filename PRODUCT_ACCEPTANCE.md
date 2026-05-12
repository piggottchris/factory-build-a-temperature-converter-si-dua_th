# Product Acceptance Contract — Issue #3

## Feature
`tests/convert.test.ts`: unit tests for the temperature-converter's parser, math, and formatter utilities, covering the full behaviour specification that drives the frontend convert library.

## Product Archetype
Developer tooling / test coverage layer for a temperature-converter POC built on FastAPI + MAF + CopilotKit.

## Primary User Journey
A developer runs `npm test` (or `pnpm test`) from `frontend/` and sees a green suite confirming that:
- the temperature-input **parser** correctly classifies every edge-case string into `empty`, `pending`, `valid`, or `invalid`,
- the **math** helpers produce exact conversion results for Celsius → Fahrenheit and Celsius → Kelvin,
- the **formatter** rounds and formats numbers according to the half-away-from-zero rule.

## Requirements

### Test coverage (acceptance criteria)

#### Parser
| Input | Expected status | Notes |
|-------|-----------------|-------|
| `''`, `'   '` | `empty` | blank / whitespace-only |
| `-`, `.`, `-.`, `-0`, `1.`, `-1.` | `pending` | incomplete-number UI state |
| `0`, `100`, `-40`, `36.6`, `.5`, `-.5` | `valid` with correct `value` | |
| `abc`, `12abc`, `1.2.3`, `--5`, `1,5`, `1e2`, `2.5e-3` | `invalid: format` | bad characters / structure |
| `1500000`, `-1000001` | `invalid: range` | outside ±1 000 000 |
| 33-character string | `invalid: format` | length guard |
| Whitespace-padded valid number | `valid` (trim applied) | |

#### Math
| Call | Expected |
|------|----------|
| `celsiusToFahrenheit(100)` | `212` |
| `celsiusToFahrenheit(-40)` | `-40` |
| `celsiusToFahrenheit(0)` | `32` |
| `celsiusToKelvin(0)` | `273.15` |

#### Formatter
| Call | Expected |
|------|----------|
| `formatNumber(212)` | `'212.00'` |
| `formatNumber(-0)` | `'0.00'` |
| `formatNumber(97.875)` | rounds per half-away-from-zero |
| Several near-zero and negative cases | see test file |

### Environment
- Node environment (no jsdom required)
- Vitest test runner, discovered under `frontend/tests/**/*.test.ts`
- `npm test` / `pnpm test` in `frontend/` must be green

### Security
Demo-mode / local-only. No authentication required. Input validation enforced in the parser (max length 32, range ±1 000 000, format allowlist).

### Observability
N/A for a pure unit-test PR — no runtime observability hooks needed.

## Success Criteria
- [ ] All parser edge-cases covered (≥ 14 distinct inputs tested)
- [ ] All math conversions tested (4 assertions)
- [ ] All formatter cases tested (≥ 4 assertions)
- [ ] `npm test` exits 0 in the `frontend/` directory
- [ ] `frontend/lib/convert.ts` source file exists with exported `parseTemperature`, `celsiusToFahrenheit`, `celsiusToKelvin`, `formatNumber`
- [ ] Vitest config updated to discover `tests/` directory
- [ ] No existing tests broken

## Known Limitations
_None at this time._
