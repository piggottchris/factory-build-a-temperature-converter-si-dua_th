## Iteration 1 — Security Hardening: remove focus-outline suppression and add no-referrer policy

- Critique: Two security/privacy gaps existed in the initial static card.
  1. `src/styles.css` had `.field__input:focus { outline: none }` — a bare `:focus` block that silently removes the browser's built-in focus ring for ALL input modalities. The correct `:focus-visible` rule immediately below it already provides a visible blue ring for keyboard users, so the bare block was both redundant and actively harmful: it makes keyboard focus invisible in browsers that predate `:focus-visible` support and is a pattern associated with clickjacking/phishing UIs that deliberately obscure focus state.
  2. `index.html` had no `<meta name="referrer">` tag. The product spec explicitly claims "no tracking" — emitting `Referer` headers on any future external navigation contradicts that claim. `no-referrer` is the correct posture for a privacy-first offline-capable static tool.
- Change:
  - Deleted the `.field__input:focus { outline: none }` block from `src/styles.css`. The `:focus-visible` block that follows it is sufficient and correct.
  - Added `<meta name="referrer" content="no-referrer" />` to the `<head>` of `index.html`, immediately after `<meta name="theme-color">`.
- Files touched: `src/styles.css`, `index.html`
- Tests: 16 passed before → 16 passed after (no regressions)
