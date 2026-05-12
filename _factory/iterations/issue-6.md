## Pass 1 — Security Hardening: Add Content-Security-Policy meta tag

**Finding:** `src/index.html` had no Content-Security-Policy declaration. The JS code
correctly uses `textContent` everywhere (no XSS via DOM writes), there are no inline event
handlers, no `as any` casts, no `JSON.parse` on user input, and no prototype-pollution
surface. The sole gap was the absence of a browser-enforced CSP — without it, any future
accidental `innerHTML` write or injected `<script>` tag would execute unchecked. A strict
meta-tag CSP provides defense-in-depth at the browser level.

**Change:** Added a `<meta http-equiv="Content-Security-Policy">` tag to `src/index.html`
with the maximally restrictive policy appropriate for a purely static, single-origin app:
`default-src 'none'; script-src 'self'; style-src 'self'; base-uri 'none'; form-action 'none'`.
This blocks all inline scripts, all external resource loads, base-tag hijacking, and form
exfiltration while permitting only the same-origin ES module bundle and stylesheet.

**Files touched:** `src/index.html`

**Tests:** pnpm test → 31 passed (unchanged)

## Pass 2 — UX/Product Polish

**Finding:** Four UX gaps in `src/index.html`:
1. The placeholder `"e.g. 100"` only showed a positive integer, giving no hint that negative values (`-40`) or decimal values (`36.6`) are valid inputs — users who type a comma-decimal or look for a range clue would get no guidance until they hit the error state.
2. The empty-hint copy "Type a temperature to convert." tells the user *what to do* but not *what they'll get*; a more contextual hint sets expectations.
3. The input had no `autofocus` attribute — on a single-purpose tool the user has to click before they can type, an unnecessary extra step.
4. `<main role="main">` carried a redundant ARIA landmark role (the implicit role of `<main>` is already `main`). The result-row `<span>` labels were also not marked `aria-hidden` even though the `<output>` element's live value already contains the unit ("212.00 °F"), creating potential double-announcement by screen readers; and the `<output>` itself lacked an `aria-label` tying it back to its scale name.

**Change:** Updated `src/index.html`:
- Removed redundant `role="main"` from `<main>`.
- Added `autofocus` to `#celsius-input` so keyboard users can type immediately on page load.
- Improved placeholder to `"e.g. 100, -40, 36.6"` — shows positive, negative, and decimal format in one glance.
- Improved empty-hint to `"Enter a Celsius value to see Fahrenheit and Kelvin equivalents."` — tells the user what the tool does and what they'll see.
- Added `aria-hidden="true"` to the visual `<span class="result-label">` spans and added `aria-label="Fahrenheit"` / `aria-label="Kelvin"` to the `<output>` elements, so screen readers announce "Fahrenheit: 212.00 °F" without duplicating the label from the sibling span.
- Added `(°F)` and `(K)` unit abbreviations to the visual result labels for sighted users who may not know the abbreviations from the output value alone.

**Files touched:** `src/index.html`

**Tests:** pnpm test → 31 passed

## Pass 3 — Backend Reliability: Fix parseCelsius to reject non-decimal literals and treat partial scientific notation as pending

**Finding:** Three reliability gaps in `src/convert.ts` `parseCelsius`:

1. **Bug — hex/binary literals accepted as valid**: `Number()` silently parses `"0x10"` as 16 and `"0b10"` as 2, so those inputs reached the `valid` branch and produced nonsensical temperature conversions. A temperature field should only accept plain decimal notation.

2. **UX reliability — partial scientific notation shown as error**: `"1e"`, `"1E+"`, `"1e-"` and similar incomplete exponent forms converted to `NaN` via `Number()` and were classified as `invalid:format`. This caused the error message to flash while the user was mid-keystroke typing `"1e6"`. They should be `pending`.

3. **Minor — Unicode minus (U+2212) treated as invalid**: Copying a negative temperature from a rich-text source (e.g. "−40 °C") produces a Unicode minus sign that `Number()` rejects. Normalising it to ASCII `-` before parsing makes copy-paste work transparently.

The existing pending guard (`trimmed === "-" || trimmed.endsWith(".")`) only covered three literal strings; it had no coverage for the partial-exponent family of mid-input states.

**Change:** Rewrote the parsing logic in `src/convert.ts`:
- Added `DECIMAL_NUMBER_RE` — a strict regex that matches only plain decimal notation (integer, decimal, and scientific forms). Explicitly rejects hex (`0x`), binary (`0b`), octal (`0o`), underscore-separated (`1_000`), comma-separated, and `Infinity`/`NaN` strings.
- Added `PENDING_RES` — an array of three regexes covering the lone-sign/dot family (`-`, `+`, `.`, `-.`, `+.`) and the partial-exponent family (`1e`, `1e+`, `1e-`).
- Added Unicode minus normalisation (`raw.replace(/−/g, "-")`) before all other checks.
- Removed the previous ad-hoc string-equality pending guard.
- Added 10 new tests in `tests/dom.test.ts` covering: lone `+`, partial sci-notation variants (`1e`, `1E`, `1e+`, `1e-`), hex/binary format errors (`0x10`, `0b10`), underscore format error, full sci-notation valid case (`1e6`), and Unicode minus valid case (`−40`).

**Files touched:** `src/convert.ts`, `tests/dom.test.ts`

**Tests:** pnpm test → 41 passed (was 31)
