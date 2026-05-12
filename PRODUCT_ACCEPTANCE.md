# Product Acceptance Contract — Issue #17

## Feature
`scripts/check-bundle.js`: gzip bundle-size guard that asserts JS ≤ 10 KB and CSS ≤ 4 KB, wired as `check:bundle` in `package.json`.

## Product Archetype
CI tooling / quality gate for a temperature-converter POC frontend built on Next.js + CopilotKit.

## Primary User Journey
A developer (or CI pipeline) runs `pnpm build && pnpm check:bundle` after every frontend build and sees a clear pass/fail report:
- **Pass**: script prints each asset's gzip size plus totals, then exits 0.
- **Fail**: script prints the offending files, their gzip sizes, and the relevant budget limit, then exits 1.

## Requirements

### Script behaviour (`scripts/check-bundle.js`)
| Scenario | Expected |
|----------|----------|
| `dist/assets/` does not exist | exit 0 (nothing to check) |
| Empty `dist/assets/` | exit 0 |
| JS files within 10 240-byte gzip budget | exit 0 |
| CSS files within 4 096-byte gzip budget | exit 0 |
| JS total gzip > 10 240 bytes | exit 1, print filename + size + limit |
| CSS total gzip > 4 096 bytes | exit 1, print filename + size + limit |
| Both JS and CSS exceed budgets | exit 1, report both violations |

### CLI interface
- `node scripts/check-bundle.js [distAssetsDir]` — first CLI argument overrides the default `dist/assets` path.
- Stdout/stderr: success messages to stdout, violation messages to stderr.

### `package.json` script
`"check:bundle": "node scripts/check-bundle.js"`

### Security
Demo-mode / local-only. No authentication required. Script reads local filesystem only; no network access.

### Observability
Exits 0 or 1; all size data printed to stdout/stderr for CI log capture.

## Success Criteria
- [ ] `scripts/check-bundle.js` exists and is runnable with `node`
- [ ] `package.json` includes `"check:bundle": "node scripts/check-bundle.js"`
- [ ] `pnpm build && pnpm check:bundle` exits 0 for the current app
- [ ] Injecting a synthetic ≥ 20 KB incompressible JS file into `dist/assets/` causes exit 1
- [ ] Injecting a synthetic ≥ 5 KB incompressible CSS file into `dist/assets/` causes exit 1
- [ ] Failure output names the file(s) and prints the budget limit
- [ ] `npm test` (vitest) passes with the new `tests/check-bundle.test.ts` suite green
- [ ] No existing tests broken

## Known Limitations
_None at this time._
