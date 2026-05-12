# Product Acceptance Contract — Temperature Converter (Issue #4)

## Product Archetype

Zero-dependency static temperature converter: single-screen card UI, Celsius input → live
Fahrenheit and Kelvin output. No server, no tracking, no accounts. Runs entirely in the browser.

## Scope of Issue #4

This issue delivers the **static card structure and base visual styles** only
(`src/index.html` + `src/styles.css`). No JavaScript logic is wired — outputs show `—`.

## Primary User Journey (this issue)

1. User opens the app in a browser (`pnpm dev`).
2. A centred card is visible on a light-grey page.
3. The card shows:
   - Heading "Temperature Converter"
   - Labelled text input (Celsius °C)
   - Helper text explaining decimal/negative entry
   - Two output rows: Fahrenheit (°F) — and Kelvin (K) —
4. No JavaScript is required for the static structure to render correctly.

## UI Requirements

| Requirement | Status |
|---|---|
| `<title>Temperature Converter</title>` | ✅ Complete |
| Meta description (privacy-safe copy) | ✅ Complete |
| `<meta name="theme-color" content="#f5f5f7">` | ✅ Complete |
| External CSS `<link>` only — no inline `<style>` | ✅ Complete |
| External `<script type="module">` only — no inline script | ✅ Complete |
| `<label for="celsius-input">Celsius (°C)</label>` | ✅ Complete |
| `<input id="celsius-input">` with `inputmode`, `autocomplete`, `maxlength`, `enterkeyhint`, `placeholder`, `aria-describedby` | ✅ Complete |
| Helper text "Decimals and negatives OK. Use '.' as the decimal point." | ✅ Complete |
| Hidden error slot (in DOM, `hidden` attribute) | ✅ Complete |
| Empty-hint element "Enter a temperature in Celsius" | ✅ Complete |
| Fahrenheit output row with `—` | ✅ Complete |
| Kelvin output row with `—` | ✅ Complete |

## CSS Requirements

| Requirement | Status |
|---|---|
| Page background `#f5f5f7` | ✅ Complete |
| Card background `#ffffff` | ✅ Complete |
| Card max-width `420px`, padding `24px`, border-radius `12px`, soft `box-shadow` | ✅ Complete |
| Font stack: `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif` | ✅ Complete |
| Input: `font-size ≥ 16px`, `padding-block ≥ 14px`, `min-height: 48px` | ✅ Complete |
| No external image URLs | ✅ Complete |

## Security Posture

- **Demo / offline mode**: static HTML/CSS only — no network calls, no auth, no data collection.
- No inline scripts or styles (Content-Security-Policy-friendly from day one).
- No third-party fonts or image CDNs.

## Observability

- Not applicable to a static card structure. Observability hooks will be added when JS logic
  is wired (issues #6+).

## Success Criteria

- [ ] `pnpm dev` renders the card with all static labels and `—` output rows.
- [ ] All HTML structure tests pass (`pnpm test`).
- [ ] No inline `<style>` or inline `<script>` present.
- [ ] Card visible and readable on 320 px viewport without horizontal scroll (base layout).

## Known Limitations

- Responsive breakpoints for `< 480 px` viewports are deferred to issue #5.
- `±` toggle button (mobile negative entry) is deferred to issue #8.
- ARIA live-region wiring is deferred to issues #10–#11.
- Accessibility audit (`pnpm test:a11y`) is deferred to issue #13.
