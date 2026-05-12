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

## Pass 4 — Test and Evaluation Coverage

**Finding:** Six coverage gaps in the test suite:

1. **No unit tests for `parseCelsius`** — all parsing tests went through DOM + `initConverter`. Each branch (empty, pending, valid, invalid:format, invalid:range) was exercised only implicitly via DOM event dispatch. Direct function-level tests were absent.

2. **No unit tests for `formatNumber`** — the formatter had no direct assertions. Exact string output for known inputs (e.g. `212 → "212.00"`, `373.15 → "373.15"`, large boundary values) was never independently verified.

3. **No unit tests for `celsiusToFahrenheit` / `celsiusToKelvin`** — the math formulas were only implicitly exercised by DOM-level tests against specific inputs. There was no test for the -40 °C crossover or absolute-zero proximity.

4. **`is-invalid` CSS class never asserted** — `main.ts` adds `is-invalid` on invalid states and removes it on empty/pending/valid. Not one test called `classList.contains("is-invalid")`, so the class mutation logic had zero coverage.

5. **`aria-describedby` removal on valid/pending untested** — there was a test that `aria-describedby` excludes "error-message" after returning to empty, but no test confirming the attribute is completely absent (not just lacking "error-message") after a valid or pending transition.

6. **Boundary output values not asserted** — the boundary tests for `1000000` and `-1000000` only checked `errorMsg.hidden`, never the actual Fahrenheit/Kelvin strings produced (`"1800032.00 °F"`, `"1000273.15 K"`, `"-1799968.00 °F"`, `"-999726.85 K"`).

**Change:** Created `tests/convert.test.ts` with 53 new unit tests covering all `parseCelsius` branches (empty, pending, invalid:format, invalid:range, valid), `celsiusToFahrenheit`, `celsiusToKelvin`, and `formatNumber` with exact string assertions. Added 19 new DOM-level tests to `tests/dom.test.ts` in four new describe blocks: `is-invalid CSS class` (6 tests), `aria-describedby transitions` (4 tests), `multi-step transition sequences` (5 tests), and `boundary output values` (4 tests). Net addition: +72 tests (53 in new file, 19 in existing file). No tests removed.

**Files touched:** `tests/convert.test.ts` (new), `tests/dom.test.ts`, `PRODUCT_ACCEPTANCE.md`

**Tests:** pnpm test → 113 passed (was 41)

## Pass 5 — Product Acceptance

**Finding:** Walked every item in PRODUCT_ACCEPTANCE.md against the source code.

Primary user journey verified by code-tracing:
- Fresh page load → `main.ts` runs `initConverter`; outputs hold `—` and `empty-hint` is
  visible (DOM initial state from HTML fixture; no input event fired yet).
- Type `100` → `parseCelsius("100")` → `{ type: "valid", value: 100 }` →
  `celsiusToFahrenheit(100) = 212` → `formatNumber(212) = "212.00"`, displayed as
  `"212.00 °F"`. `celsiusToKelvin(100) = 373.15` → `"373.15 K"`. Confirmed by
  `tests/dom.test.ts` "shows 212.00 °F for 100 °C" / "shows 373.15 K for 100 °C".
- Clear → `parseCelsius("") = { type: "empty" }` → outputs reset to `—`, hint shown,
  `aria-describedby = "empty-hint"`. Confirmed by "outputs revert to — after clearing".
- Type `9999999` → `parseCelsius("9999999") = { type: "invalid", reason: "range" }` →
  `MSG_RANGE` shown. Confirmed by "shows range error for value above 1 000 000".
- Type `abc` → `{ type: "invalid", reason: "format" }` → `MSG_FORMAT` shown. Confirmed.
- Correct to `0` → `{ type: "valid", value: 0 }` → `"32.00 °F"` / `"273.15 K"`. Confirmed.

All 11 UI/Frontend requirements verified as implemented and all unchecked boxes ticked.
Security demo-mode limitation documented under Known Limitations. CI integration gap
(Issue #19) documented — per the hard rule against touching `.github/workflows/*` in a
refinement pass, the ci.yml addition is deferred to Issue #19's PR.

**Change:**
- Ticked all 11 UI/Frontend requirement checkboxes in `PRODUCT_ACCEPTANCE.md` with
  inline evidence (file/line references).
- Ticked the Security demo-mode checkbox.
- Expanded "Known Limitations" with three entries: authentication (n/a), security posture
  (CSP policy documented), and CI integration gap (Issue #19 tracked, not yet wired).

**Files touched:** `PRODUCT_ACCEPTANCE.md`

**Tests:** pnpm test → 113 passed
