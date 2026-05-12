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
