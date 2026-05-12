# Product Acceptance Contract — Issue #10

## Feature
Accessibility: ARIA wiring, focus styles, tab order, and colour-contrast documentation.

## Product Archetype
Zero-dependency static temperature converter — single-screen card UI, Celsius input → Fahrenheit
and Kelvin output. Runs entirely in the browser.

## Primary User Journey
A keyboard or assistive-technology user visits the temperature converter card:

1. Tab into the page → `#celsius-input` receives focus with a clearly visible `2px solid` outline ring.
2. Tab again → `#sign-toggle` (±) button receives focus with the same style-family ring.
3. Shift-Tab → focus returns to `#celsius-input`.
4. Screen reader reads "Celsius (°C)" as the label, plus the helper text via `aria-describedby`.
5. When the user triggers an error, `aria-describedby` expands to include `celsius-error`, so screen
   readers announce the error message.
6. When the error is cleared, `aria-describedby` contracts back to only `celsius-helper`.

## Requirements

### ARIA (`src/main.ts`)
| Requirement | Status |
|---|---|
| `aria-describedby` on `#celsius-input` initially contains only `celsius-helper` | [x] |
| JS adds `celsius-error` to `aria-describedby` when error is active | [x] |
| JS removes `celsius-error` from `aria-describedby` when error is cleared | [x] |
| Output `<dd>` rows have accessible names from their visible `<dt>` labels | [x] |

### Focus styles (`src/styles.css`)
| Requirement | Status |
|---|---|
| `:focus-visible` on `#celsius-input` — minimum `2px solid` outline, clearly visible | [x] |
| `:focus-visible` on `#sign-toggle` — same style family | [x] |
| No `outline: none` globally (at `*`, `html`, or `body` level) | [x] |

### Tab order
| Requirement | Status |
|---|---|
| Natural DOM order: input → `±` button | [x] |
| No stray `tabindex` on `#celsius-input` | [x] |
| No stray `tabindex` on `#sign-toggle` | [x] |

### Structure
| Requirement | Status |
|---|---|
| `#sign-toggle` button present in DOM | [x] |
| `#celsius-error` is in DOM with `hidden` attribute initially | [x] |
| `#celsius-error` has `aria-live="polite"` | [x] |

## Security Posture
Demo / offline mode: static HTML/CSS/JS only — no network calls, no auth, no data collection.
No inline scripts or styles (CSP-friendly). No third-party fonts or image CDNs.

## Observability
Not applicable to static client-side code.

## Success Criteria
- [x] All a11y tests pass (`npm test` at repo root)
- [x] `#celsius-input` tab produces visible focus ring (≥ 2px solid)
- [x] `#sign-toggle` tab produces visible focus ring (same style family)
- [x] `aria-describedby` toggling verified by unit test
- [x] No global `outline: none` in CSS
- [x] Colour contrast ratio ≥ 4.5:1 for all informational text pairs (documented below)

## Colour Contrast Pairs

Ratios are computed from WCAG 2.1 relative luminance formula (verified programmatically).

| Element | Foreground | Background | Ratio | WCAG AA |
|---|---|---|---|---|
| Body text / headings | `#1d1d1f` | `#ffffff` (card) | 16.83:1 | ✅ Pass |
| Input text | `#1d1d1f` | `#f5f5f7` (input bg) | 15.46:1 | ✅ Pass |
| Label text | `#3a3a3c` | `#ffffff` | 11.35:1 | ✅ Pass |
| Helper/hint text | `#6e6e73` | `#ffffff` | 5.07:1 | ✅ Pass |
| Error text | `#d93025` | `#ffffff` | 4.77:1 | ✅ Pass |
| Empty-state `<dd>` | `#aeaeb2` | `#ffffff` | 2.21:1 | ⚠️ Decorative placeholder only (em-dash), not conveying information; screen reader fallback via `role="status"` hint |
| Focus ring | `#0060d1` | `#f5f5f7` (page bg) | 5.37:1 | ✅ Pass |

## Known Limitations
- Full automated axe-core audit deferred to issue #13.
- Playwright e2e keyboard flow deferred to issue #11.
- Responsive breakpoints `< 480px` from issue #5 not included in this branch.

---

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
- [x] `frontend/lib/main.ts` exists and exports `init`, `FORMAT_ERROR_MSG`, `RANGE_ERROR_MSG`
- [x] `frontend/tests/dom.test.ts` exists and covers all scenarios above
- [x] All state-transition tests pass
- [x] All static-text tests pass
- [x] `npm test` exits 0 in `frontend/` (both test files green)
- [x] No existing tests broken (`convert.test.ts` and `example.test.tsx` still pass)

## Known Limitations

1. **No visual UI shipped in this PR** — `lib/main.ts` is wired up as a tested library; `app/page.tsx` still renders the scaffold haiku-agent chat UI and does not include the temperature-converter HTML elements. A follow-on PR would add the HTML fixture to `page.tsx` and call `init()` on mount.

2. **No backend changes** — all conversion logic is client-side in `lib/convert.ts`. There is no server-side validation endpoint, no persistence, and no API contract with the FastAPI backend.

3. **No observability hooks** — this is a pure frontend test PR; no runtime metrics, logging, or error-reporting are included.
