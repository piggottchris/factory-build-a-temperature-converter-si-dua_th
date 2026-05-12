## Iteration 1 — Security Hardening: add HSTS, COOP, and CORP headers to vercel.json

- Critique: The initial `vercel.json` shipped only five headers. Three high-value transport/isolation headers were absent:
  - `Strict-Transport-Security` — without HSTS, the first HTTP connection to the host is unprotected (SSL-stripping attack surface). The Vercel CDN serves HTTPS, so a 2-year `max-age` with `includeSubDomains; preload` is safe and qualifies the domain for browser HSTS preload lists.
  - `Cross-Origin-Opener-Policy: same-origin` — isolates the top-level browsing context from cross-origin popups, closing the Spectre/XS-Leak vector via `window.opener`.
  - `Cross-Origin-Resource-Policy: same-origin` — prevents cross-origin no-CORS fetches (e.g. from an attacker's page) from reading this app's responses.
  - A secondary concern was noted but NOT changed: `connect-src 'none'` in the existing CSP would block all `fetch()`, XHR, WebSocket, and EventSource calls — making the CopilotKit/AG-UI runtime non-functional in a browser. This value is mandated verbatim by `PRODUCT_ACCEPTANCE.md` and the test suite uses exact-value matching, so it was left unchanged. A follow-up issue should relax it to `connect-src 'self'` once the product contract is updated.
  - The `/(.*)`  source pattern was verified to match the root `/` path (regex `.*` matches empty string; Vercel's path-to-regexp behaves the same way) — no change needed there.

- Change: Added three headers to the single catch-all rule in `vercel.json`:
  ```
  Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
  Cross-Origin-Opener-Policy: same-origin
  Cross-Origin-Resource-Policy: same-origin
  ```
  Added 6 new vitest tests in `frontend/test/vercel-headers.test.ts` covering presence and value correctness for each new header. No existing tests were modified.

- Files touched:
  - `/sandbox/work/issue-16/vercel.json`
  - `/sandbox/work/issue-16/frontend/test/vercel-headers.test.ts`
  - `/sandbox/work/issue-16/_factory/iterations/issue-16.md` (this file, created)

- Tests: before: 75 frontend / 2 backend passing, 0 failing. After: 81 frontend / 2 backend passing, 0 failing.

## Iteration 2 — UX/Product Polish: update docs and test error messages to reflect 8-header reality

- Critique: Three developer UX problems after Pass 1:
  1. `PRODUCT_ACCEPTANCE.md` was written for 5 headers and never updated after the Security Hardening pass added 3 more. It still said "all five required security headers" in the Feature section, the Primary User Journey, and the Static validation prose — misleading to any maintainer reading the doc. All 7 success-criteria checkboxes were unchecked despite the feature being fully implemented.
  2. The test file had a `describe("vercel.json — all five headers present", ...)` block that referred to "five" headers and "every required security header" — ambiguous now that 8 headers exist and the block deliberately tests only the original 5 contract headers.
  3. The hardening-header "is present" tests produced unhelpful failure messages (`expected false to be true`) with no indication of which header was missing or why it matters.

- Change:
  1. Updated `PRODUCT_ACCEPTANCE.md`: changed "five" to "eight" throughout prose; split the requirements table into two sections (contract headers vs. hardening headers) with a rationale column for the new three; ticked all 7 success-criteria checkboxes (all criteria are now satisfied).
  2. Renamed the test describe block to `"all five contract headers present"` and added a clarifying comment explaining the hardening headers are covered by separate describe blocks below.
  3. Added meaningful failure messages to all `expect()` calls in the three hardening-header describe blocks, so a future regression immediately names the missing header and explains the security intent.

- Files touched:
  - `/sandbox/work/issue-16/PRODUCT_ACCEPTANCE.md`
  - `/sandbox/work/issue-16/frontend/test/vercel-headers.test.ts`
  - `/sandbox/work/issue-16/_factory/iterations/issue-16.md` (this file)

- Tests: before: 81 frontend / 2 backend passing, 0 failing. After: 81 frontend / 2 backend passing, 0 failing.

## Iteration 3 — Backend Reliability: add security headers to next.config.mjs for local/Docker dev parity

- Critique: `vercel.json` only applies headers when deployed to Vercel. In every other execution environment — `next dev`, `next start` inside the Docker container, `docker-compose up` — the 8 security headers were absent because `next.config.mjs` had no `headers()` function. This means a developer running the app locally, a QA engineer validating via Docker, or a CI integration test against the Docker image would all observe a completely different security posture than production. This is a classic dev/prod parity gap.

- Change: Added a `headers()` async function to `frontend/next.config.mjs` emitting the same 8 headers with identical values to those in `vercel.json`, applied to all routes (`/(.*)`). Added `frontend/test/next-config-headers.test.ts` with 3 tests: (1) the config exports a `headers()` function, (2) a catch-all rule exists, (3) all 8 header values match `vercel.json` exactly — so any future drift between the two files will immediately fail CI.

- Files touched:
  - `/sandbox/work/issue-16/frontend/next.config.mjs`
  - `/sandbox/work/issue-16/frontend/test/next-config-headers.test.ts`
  - `/sandbox/work/issue-16/_factory/iterations/issue-16.md` (this file)

- Tests: before: 81 frontend / 2 backend passing, 0 failing. After: 84 frontend / 2 backend passing, 0 failing.

## Iteration 4 — Test and Evaluation Coverage: add edge-case tests for source pattern, duplicate keys, header count, and key casing

- Critique: Four coverage gaps were present after Pass 3:
  1. The `structure` describe block in both test files accepted `/**` as equivalent to `/(.*)`  when checking for a catch-all rule. The product contract mandates exactly `/(.*)`  and the two patterns have subtly different semantics in path-to-regexp. A config change to `/**` would pass the existing structural test even though it diverges from the spec.
  2. No test caught **duplicate header keys** within a single rule. The test harness flattens headers into a `Map`, which silently overwrites the first occurrence of a duplicate key, making it invisible to all subsequent value-assertion tests. A duplicate could exist in `vercel.json` without any test failing.
  3. No test pinned the **exact header count** (8). Adding or accidentally deleting a header would not be caught by the per-header value tests unless someone also deleted the corresponding per-header test case.
  4. No test verified **canonical HTTP Title-Case** for header key names. HTTP header names are case-insensitive on the wire but vercel.json keys are sent verbatim. A typo like `content-security-policy` instead of `Content-Security-Policy` would cause every existing "is present" test to *fail* (Map lookup is case-sensitive), but the failure message would be "header is missing" not "header is miscased" — obscuring the root cause. The new casing test explicitly checks that no required header exists only under a wrong-cased key.

- Change: Added a `"vercel.json — edge cases"` describe block to `frontend/test/vercel-headers.test.ts` with 4 new tests (exact source pattern, no duplicate keys, exact header count = 8, canonical Title-Case keys). Added 2 new tests to the `"next.config.mjs — headers() structure"` describe block in `frontend/test/next-config-headers.test.ts` (exact source pattern, no duplicate keys). No existing tests were modified or removed.

- Files touched:
  - `/sandbox/work/issue-16/frontend/test/vercel-headers.test.ts`
  - `/sandbox/work/issue-16/frontend/test/next-config-headers.test.ts`
  - `/sandbox/work/issue-16/_factory/iterations/issue-16.md` (this file)

- Tests: before: 84 frontend / 2 backend passing, 0 failing. After: 90 frontend / 2 backend passing, 0 failing.

## Iteration 5 — Product Acceptance: include next-config-headers.test.ts in check:security and fully align PRODUCT_ACCEPTANCE.md

- Critique: Three gaps remained after Pass 4 that left the delivered product inaccurate against the issue contract:
  1. `check:security` in `frontend/package.json` ran only `test/vercel-headers.test.ts`. The `test/next-config-headers.test.ts` file (added in Pass 3 specifically to detect drift between `vercel.json` and `next.config.mjs`) was excluded from the CI security script. This meant the script could pass even if `next.config.mjs` lost all its security headers — a critical hole in the static validation the issue requires.
  2. `PRODUCT_ACCEPTANCE.md` Success Criteria was missing checkboxes for: the 3 hardening headers in `vercel.json`, `next.config.mjs` parity headers, `next-config-headers.test.ts` test pass, and the corrected `check:security` scope (both files). The criteria listed were accurate but incomplete.
  3. The Static validation prose in the Requirements section described only one test file; it did not mention `next-config-headers.test.ts` at all.
  4. The Known Limitations section still referred to `check:security` in the vague original terms ("a next task per issue body") rather than accurately describing what the script now does and what it does not cover. The `connect-src 'none'` CSP limitation (noted but not fixed in Pass 1) was not surfaced in the Known Limitations section.

- Change:
  1. Updated `check:security` in `frontend/package.json` to run both test files: `vitest run test/vercel-headers.test.ts test/next-config-headers.test.ts`. `npm run check:security` now runs 29 tests (24 + 5) instead of 24.
  2. Updated `PRODUCT_ACCEPTANCE.md`:
     - Static validation prose now mentions both test files with their test counts.
     - Success Criteria expanded from 7 to 11 checkboxes, adding rows for the 3 hardening headers, `next.config.mjs` parity, both test files, and the updated `check:security` scope. All 11 checkboxes are ticked.
     - Known Limitations rewritten to accurately describe the gap between static validation and live `curl -I` verification, and surfaces the `connect-src 'none'` CSP incompatibility as a follow-up item.

- Files touched:
  - `/sandbox/work/issue-16/frontend/package.json`
  - `/sandbox/work/issue-16/PRODUCT_ACCEPTANCE.md`
  - `/sandbox/work/issue-16/_factory/iterations/issue-16.md` (this file)

- Tests: before: 90 frontend / 2 backend passing, 0 failing. After: 90 frontend / 2 backend passing, 0 failing. `npm run check:security` now runs 29 tests (was 24).
