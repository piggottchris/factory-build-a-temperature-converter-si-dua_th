## Iteration 1 — Security Hardening: guard formatNumber against non-finite inputs

- Critique: `formatNumber` is a public export. Passing `Infinity`, `-Infinity`, or `NaN` directly to it produces the misleading strings `"Infinity"`, `"-Infinity"`, or `"NaN"` via `Number.prototype.toFixed` — not a numeric display string. The parser itself can never produce non-finite values in a `valid` result (COMPLETE_NUMBER_RE + the range check prevent it), but the exported function has no contract enforcement. A downstream caller (e.g. a new conversion helper, a test harness, or a future API response path) could pass a non-finite value and silently receive garbage output with no error surfaced.
- Change: Added an `isFinite(n)` guard at the top of `formatNumber` that throws a `TypeError` for `NaN`, `Infinity`, and `-Infinity`. Added three new vitest assertions that confirm the `TypeError` is thrown for each non-finite case. No existing tests were modified or weakened.
- Files touched: `frontend/lib/convert.ts`, `frontend/tests/convert.test.ts`
- Tests: 40 passed before → 43 passed after (3 new security hardening tests added, 0 failures)
