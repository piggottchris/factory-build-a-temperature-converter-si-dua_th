## Iteration 2 — UX/Product Polish: export type guards for ParseResult discriminated union

- Critique: `ParseResult` is a discriminated union with four variants, but the module exported no type guard helpers. Every downstream caller (component code, future API adapters) had to repeat `if (result.status === 'valid')` boilerplate — correct but not ergonomic and not self-documenting. The `pending` state's purpose (suppressing premature error flashing while the user is mid-entry) was described only in the module-level comment, not at the type/function level where component authors would encounter it. No type guard tests existed to protect the narrowing contract.
- Change: Added four exported type guard functions — `isEmptyResult`, `isPendingResult`, `isValidResult`, `isInvalidResult` — each with a JSDoc explaining its UX intent (e.g. `isPendingResult` explains the neutral-state / anti-flicker rationale). Upgraded the module-level doc to explicitly cross-reference these guards and to describe each state's UI implication. Added 9 new vitest tests that exercise every guard: true/false cases, and narrowing correctness verified by accessing `.value` and `.reason` inside the guarded branch. No existing tests were modified.
- Files touched: `frontend/lib/convert.ts`, `frontend/tests/convert.test.ts`
- Tests: 43 passed before → 52 passed after (9 new type guard tests added, 0 failures)

## Iteration 1 — Security Hardening: guard formatNumber against non-finite inputs

- Critique: `formatNumber` is a public export. Passing `Infinity`, `-Infinity`, or `NaN` directly to it produces the misleading strings `"Infinity"`, `"-Infinity"`, or `"NaN"` via `Number.prototype.toFixed` — not a numeric display string. The parser itself can never produce non-finite values in a `valid` result (COMPLETE_NUMBER_RE + the range check prevent it), but the exported function has no contract enforcement. A downstream caller (e.g. a new conversion helper, a test harness, or a future API response path) could pass a non-finite value and silently receive garbage output with no error surfaced.
- Change: Added an `isFinite(n)` guard at the top of `formatNumber` that throws a `TypeError` for `NaN`, `Infinity`, and `-Infinity`. Added three new vitest assertions that confirm the `TypeError` is thrown for each non-finite case. No existing tests were modified or weakened.
- Files touched: `frontend/lib/convert.ts`, `frontend/tests/convert.test.ts`
- Tests: 40 passed before → 43 passed after (3 new security hardening tests added, 0 failures)
