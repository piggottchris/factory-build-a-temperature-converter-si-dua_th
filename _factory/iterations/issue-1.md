## Iteration 1 — Security Hardening: reject NaN and Infinity inputs in temperature conversion

- Critique: Both `convert_temperature` (Python) and `convertTemperature` (TypeScript) checked `value < abs_zero - 1e-9` as their sole input guard. In IEEE 754, `NaN < x` always evaluates to `False`, so `float('nan')` / `NaN` silently bypassed the absolute-zero check and propagated through arithmetic, producing `NaN` outputs with no error. `Infinity` similarly passed and returned `Infinity`. The MAF tool's `value: float` type annotation accepts these special values, and the agent would have returned strings like `"0 celsius = nan fahrenheit"` — a silent data-integrity failure that could mislead users and downstream consumers.

- Change: Added explicit `math.isnan` / `math.isinf` guards in `convert_temperature` (Python) immediately after unit validation, before the absolute-zero check. Added equivalent `Number.isNaN` / `!Number.isFinite` guards in `convertTemperature` (TypeScript). Added 3 new pytest cases (`test_nan_value_raises`, `test_positive_infinity_raises`, `test_negative_infinity_raises`) and 3 new vitest cases for the same inputs. Ticked both Security checkboxes in PRODUCT_ACCEPTANCE.md (the secrets checkbox was already satisfied; the absolute-zero checkbox is now fully closed because NaN no longer bypasses it).

- Files touched:
  - backend/app/agents/temperature_agent.py
  - backend/app/tests/test_temperature_agent.py
  - frontend/app/lib/temperature.ts
  - frontend/test/temperature.test.ts
  - PRODUCT_ACCEPTANCE.md

- Tests: backend 32 passed → 35 passed (3 added); frontend 23 passed → 26 passed (3 added). No regressions.

## Iteration 2 — UX/Product Polish: smart result precision and Enter-key submit on quick converter

- Critique: Two UX friction points were present. (1) Result formatting always used `.toFixed(4)`, so canonical values like 100°C → Fahrenheit displayed as "212.0000°F" instead of "212°F", and 37°C → Fahrenheit displayed as "98.6000°F" instead of "98.6°F". This is visual clutter that makes the tool feel unpolished. (2) The temperature value `<input>` had no `onKeyDown` handler, so pressing Enter after typing a value did nothing — users must mouse to the Convert button, which breaks the natural input → Enter → result flow expected from any form widget.

- Change: Added `smartRound(value: number): string` export to `frontend/app/lib/temperature.ts`. It applies `.toFixed(4)` then passes the result through `parseFloat().toString()` to strip trailing fractional zeros, producing "212" from 212.0000 and "98.6" from 98.6000 while capping irrational results at 4 decimal places (e.g. 1/3 → "0.3333"). Updated `page.tsx` to import and use `smartRound` in the result display, replacing the raw `.toFixed(4)` call. Added `onKeyDown` handler on the value input that calls `handleConvert()` when `e.key === "Enter"`. Added 7 new vitest tests for `smartRound` covering whole numbers, trailing zero stripping, meaningful decimals, rounding to 4 places, negative values, and zero.

- Files touched:
  - frontend/app/lib/temperature.ts
  - frontend/app/page.tsx
  - frontend/test/temperature.test.ts

- Tests: backend 35 passed (no change); frontend 26 passed → 33 passed (7 added). No regressions.
