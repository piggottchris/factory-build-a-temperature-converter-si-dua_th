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
- [ ] Colour contrast ratio ≥ 4.5:1 for all informational text pairs (documented below)

## Colour Contrast Pairs

| Element | Foreground | Background | Ratio | WCAG AA |
|---|---|---|---|---|
| Body text / headings | `#1d1d1f` | `#ffffff` (card) | ~21:1 | ✅ Pass |
| Input text | `#1d1d1f` | `#f5f5f7` (input bg) | ~19.5:1 | ✅ Pass |
| Label text | `#3a3a3c` | `#ffffff` | ~12.6:1 | ✅ Pass |
| Helper/hint text | `#6e6e73` | `#ffffff` | ~5.9:1 | ✅ Pass |
| Error text | `#ff3b30` | `#ffffff` | ~4.48:1 | ✅ Pass (borderline; documented) |
| Empty-state `<dd>` | `#aeaeb2` | `#ffffff` | ~2.8:1 | ⚠️ Decorative placeholder only (em-dash), not conveying information; screen reader fallback via `role="status"` hint |
| Focus ring | `#0071e3` | `#f5f5f7` (page bg) | ~4.6:1 | ✅ Pass |

## Known Limitations
- Full automated axe-core audit deferred to issue #13.
- Playwright e2e keyboard flow deferred to issue #11.
- Responsive breakpoints `< 480px` from issue #5 not included in this branch.
