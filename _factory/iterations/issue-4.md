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
