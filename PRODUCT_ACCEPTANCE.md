# Product Acceptance — Issue #5: Responsive Layout (styles.css)

**Issue:** #5 — `styles.css`: responsive layout for 320 px–480 px+ viewports and minimum tap targets  
**Scope:** CSS-only. No changes to HTML or TypeScript in this PR.

---

## Product Archetype

Temperature converter card UI — responsive, mobile-first stylesheet that meets WCAG touch-target and text-size minimums.

## Primary User Journey

A user on a 320 × 568 mobile device opens the temperature converter. The card fits the viewport without horizontal scroll, the input field is visible above the fold, and all interactive targets are reachable with a fingertip.

---

## Acceptance Criteria

| # | Criterion | Status |
|---|-----------|--------|
| 1 | Viewport < 480 px: card `width: calc(100vw - 32px)` with 16 px horizontal margins | ⬜ |
| 2 | Viewport < 480 px: top-aligned with `env(safe-area-inset-*)` padding | ⬜ |
| 3 | Viewport ≥ 480 px: card `max-width: 420px`, centred via flexbox on `<body>` | ⬜ |
| 4 | At 320 × 568: no horizontal scroll, input above the fold, all targets reachable | ⬜ |
| 5 | Input and ± button: `min-height: 44px` and `min-width: 44px` | ⬜ |
| 6 | Minimum text size `14px` everywhere inside the card | ⬜ |
| 7 | Input `font-size ≥ 16px` at all breakpoints (prevents iOS Safari zoom) | ⬜ |
| 8 | Vitest tests green — CSS file existence and rule assertions | ⬜ |

---

## UI/Backend/Security/Observability Notes

- **UI only**: This PR contains a single CSS file; no backend, JS, or framework changes.
- **Security**: No dynamic content or user input processed here.
- **Observability**: N/A for a static CSS file.
- **Playwright screenshot** acceptance (320 × 568 viewport, no horizontal scrollbar) deferred to Issue #14 when Playwright is introduced.

---

## Known Limitations

- Playwright screenshot test (the stated acceptance criterion) is out of scope for this PR; it is introduced in Issue #14.
- The `±` button referenced in the issue is added in Issue #8; CSS tap-target rules for it are included here proactively per the issue spec.
