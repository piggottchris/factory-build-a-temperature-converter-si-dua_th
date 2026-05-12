## Iteration 4 — Test and Evaluation Coverage: close all structural-assertion gaps in html-structure.test.ts

- Critique: Nine distinct coverage gaps existed in the existing 16-test suite:
  1. `placeholder` on `#celsius-input` was checked only `.toBeTruthy()` — the required exact value `"e.g. 100"` was never asserted.
  2. `aria-describedby` was checked for "at least 2 IDs" but never verified the specific IDs `celsius-helper` and `celsius-error` were both present.
  3. Helper-text copy was checked with a loose `/decimal/i` regex; the exact sentence `Decimals and negatives OK. Use "." as the decimal point.` was never pinned.
  4. The error-slot test used a multi-criteria OR (`hasAttribute('hidden') || aria-hidden=true || data-state=hidden || id.includes('error')`) that would pass even if `hidden` was absent — it was matching on `id.includes('error')` alone.
  5. `aria-live="polite"` on `#celsius-error` was never tested at all.
  6. `role="status"` on `#celsius-hint` was never tested at all.
  7. The `<dl>` / `<dt>` / `<dd>` semantic structure was not tested — only loose body-text regex matches confirmed presence of the words "Fahrenheit" and "Kelvin".
  8. Exact `<dt>` label strings `"Fahrenheit (°F)"` and `"Kelvin (K)"` were never asserted.
  9. The `results__value--empty` CSS modifier class on both `<dd>` output elements (added in iteration 2) was never exercised by a test, meaning regression protection was absent for that UX requirement.
- Change:
  - Added `it('#celsius-input placeholder is exactly "e.g. 100"')` asserting `.toBe('e.g. 100')`.
  - Replaced the loose `aria-describedby` ID-count test with one that uses `.toContain('celsius-helper')` and `.toContain('celsius-error')`.
  - Replaced the loose `/decimal/i` helper-text test with an exact-copy assertion (with whitespace normalisation to handle HTML entity rendering).
  - Split the former multi-criteria error-slot test into two focused tests: one asserting `hasAttribute('hidden') === true`, one asserting `getAttribute('aria-live') === 'polite'`.
  - Replaced the generic hint-text search with `getElementById('celsius-hint')` + exact `.textContent` match; added a dedicated `role="status"` assertion alongside it.
  - Replaced the two loose body-text output-row tests (7 lines, 4 regex matchers) with 8 focused tests: `<dl>` existence, `<dt>` count = 2, `<dd>` count = 2, exact Fahrenheit label, exact Kelvin label, em-dash text for each `<dd>`, and `results__value--empty` class presence on both `<dd>` elements.
- Files touched: `tests/html-structure.test.ts`
- Tests: 16 passed before → 25 passed after (0 failures; 9 new assertions added)

## Iteration 3 — Backend Reliability: fix tsc strict-mode failures and add check:types script

- Critique: `tsc --noEmit` exited with 5 errors under strict mode, making the project silently broken from a TypeScript perspective:
  1. Three stub test files (`tests/a11y.test.ts`, `tests/convert.test.ts`, `tests/dom.test.ts`) imported `it` from vitest but never used it. With `noUnusedLocals: true` this is a hard error. These stubs only call `describe.todo`, so `it` was an accidental leftover that would trip any future TypeScript-aware CI step.
  2. `tests/html-structure.test.ts` uses `node:fs`, `node:path`, and `__dirname`, but `@types/node` was not in `devDependencies`. TypeScript could not resolve these node built-in declarations.
  3. `jsdom` was used directly in `html-structure.test.ts` with no type declarations — `@types/jsdom` was also absent, causing `Could not find a declaration file for module 'jsdom'` errors. 
  4. There was no `check:types` script in `package.json`, so `tsc --noEmit` was never surfaced as a runnable step. Vite's build pipeline does not run `tsc`, so these errors were invisible during normal development.
- Change:
  - Installed `@types/node` and `@types/jsdom` as dev dependencies (via `pnpm add -D`).
  - Removed the unused `it` import from the three stub test files, replacing `import { describe, it }` with `import { describe }`.
  - Added `"check:types": "tsc --noEmit"` to the `scripts` section of `package.json`. `tsc --noEmit` now exits 0.
- Files touched: `package.json`, `pnpm-lock.yaml`, `tests/a11y.test.ts`, `tests/convert.test.ts`, `tests/dom.test.ts`
- Tests: 16 passed before → 16 passed after (no regressions); `tsc --noEmit` 5 errors before → 0 errors after

## Iteration 2 — UX/Product Polish: strengthen heading hierarchy and dim em-dash placeholders

- Critique: Two interrelated visual-hierarchy gaps existed.
  1. The `<h1>` was styled at `1.25rem / font-weight: 600` — only marginally larger than `1rem` body text and no heavier than a label. At a glance the card lacked a clear dominant anchor; the heading did not read as a heading.
  2. The em-dash placeholder values (`—`) in the Fahrenheit and Kelvin output rows shared identical styling with what live numeric values will use: `1.125rem / font-weight: 600 / color: #1d1d1f`. This means the visual state before and after JS populates a result is indistinguishable — users get no clear signal that output has appeared, and the placeholders feel as prominent as real data.
- Change:
  - `.card__heading`: bumped to `font-size: 1.5rem`, `font-weight: 700`, added `line-height: 1.2`, tightened `letter-spacing` to `-0.02em`. The heading is now unmistakably the dominant element in the card.
  - Added `.results__value--empty` CSS modifier: `color: #aeaeb2` (soft grey) and `font-weight: 400`. Applied to both `<dd id="fahrenheit-output">` and `<dd id="kelvin-output">` in `index.html`. When JS (issue #7) writes a real value, it removes this class, producing a clear visual change that signals output is live. This directly implements the "empty-state hint visually distinct (grey, smaller weight)" UX criterion.
- Files touched: `src/styles.css`, `index.html`
- Tests: 16 passed before → 16 passed after (no regressions)

## Iteration 1 — Security Hardening: remove focus-outline suppression and add no-referrer policy

- Critique: Two security/privacy gaps existed in the initial static card.
  1. `src/styles.css` had `.field__input:focus { outline: none }` — a bare `:focus` block that silently removes the browser's built-in focus ring for ALL input modalities. The correct `:focus-visible` rule immediately below it already provides a visible blue ring for keyboard users, so the bare block was both redundant and actively harmful: it makes keyboard focus invisible in browsers that predate `:focus-visible` support and is a pattern associated with clickjacking/phishing UIs that deliberately obscure focus state.
  2. `index.html` had no `<meta name="referrer">` tag. The product spec explicitly claims "no tracking" — emitting `Referer` headers on any future external navigation contradicts that claim. `no-referrer` is the correct posture for a privacy-first offline-capable static tool.
- Change:
  - Deleted the `.field__input:focus { outline: none }` block from `src/styles.css`. The `:focus-visible` block that follows it is sufficient and correct.
  - Added `<meta name="referrer" content="no-referrer" />` to the `<head>` of `index.html`, immediately after `<meta name="theme-color">`.
- Files touched: `src/styles.css`, `index.html`
- Tests: 16 passed before → 16 passed after (no regressions)
