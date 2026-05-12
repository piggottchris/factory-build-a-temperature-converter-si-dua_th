## Iteration 5 — Product Acceptance: all success criteria verified and ticked

- Critique: `PRODUCT_ACCEPTANCE.md` had all eight success criteria still unchecked despite every
  criterion being satisfied by the implementation. A product-acceptance pass without verification
  results leaves the contract unreadable as evidence of completion.

- Change: Walked each of the eight success criteria manually:
  1. `scripts/check-bundle.js` exists — confirmed via `node scripts/check-bundle.js` (exits 0,
     prints the "not found — skipping" + Next.js hint for the default `dist/assets/` path).
  2. `package.json` `check:bundle` script — confirmed `"check:bundle": "node scripts/check-bundle.js"`
     present in `package.json`.
  3. Exit 0 when `dist/assets/` does not exist — confirmed: running the script against the
     non-existent default path exits 0 with a helpful Next.js hint. This is the expected state
     after `next build` (which writes to `.next/`, not `dist/assets/`).
  4. Synthetic ≥ 20 KB JS file → exit 1 — confirmed: `crypto.randomBytes(20 * 1024)` written to
     `dist/assets/main.js`; script printed `JS total gzip: 20508 B exceeds budget 10240 B` with
     filename and exited 1.
  5. Synthetic ≥ 5 KB CSS file → exit 1 — confirmed: `crypto.randomBytes(5 * 1024)` written to
     `dist/assets/styles.css`; script printed `CSS total gzip: 5143 B exceeds budget 4096 B` with
     filename and exited 1.
  6. Failure output names file(s) + budget — confirmed from criteria 4 & 5 runs above.
  7. `npm test` passes with 91 tests green — confirmed via `npm test -- --run` (3 test files,
     91 tests, all passed).
  8. No existing tests broken — confirmed (same run).
  All eight boxes ticked in `PRODUCT_ACCEPTANCE.md`.

- Files touched:
  - `/sandbox/work/issue-17/PRODUCT_ACCEPTANCE.md`

- Tests: 91 passed (no change — no code was modified, all criteria already met)

## Iteration 4 — Test and Evaluation Coverage: boundary, accumulation, mixed-verdict, and count-accuracy tests

- Critique: The 83-test suite had four concrete coverage gaps:
  (a) **Boundary exactly at budget** — the spec requires `≤ budget` to pass, but no test verified
  the case where a file's gzip output equals the budget exactly (10 240 B for JS, 4 096 B for
  CSS). A strict `<` bug in the comparison would pass every other test and silently violate the
  contract.
  (b) **Multi-file accumulation** — all over-budget tests used a single large file. A bug where
  `total` was reset to each file's size rather than accumulated would pass every existing test
  (the single file is already over budget) while breaking the real use-case of two medium-sized
  bundles whose combined size crosses the threshold.
  (c) **Mixed pass/fail** — the only multi-type test had both JS and CSS failing simultaneously.
  A bug that short-circuited on the first violation without evaluating the second type would
  pass every test. No test verified "JS within budget + CSS over budget → exit 1" or the
  reverse.
  (d) **File-count label accuracy for skipped entries** — the UX iteration added an `N files
  checked` label, but no test checked that skipped symlinks or `.js`-named directories were not
  counted in that label, meaning an off-by-one in the count logic could go undetected.

- Change: Added 8 new tests across 4 focused groups:
  1. **Accumulation (JS + CSS)**: two ~5 900-byte files each under the JS budget individually
     (~5 923 B gzip each), combined ~11 846 B > 10 240 B → exit 1.  Mirrored for CSS.
  2. **Boundary (JS + CSS)**: `randomBytes(10217)` gzip-compresses to exactly 10 240 B; script
     must exit 0.  `randomBytes(4073)` gzip-compresses to exactly 4 096 B; script must exit 0.
     The 23-byte gzip overhead for incompressible data is constant (deflate stored-block fixed
     header/trailer), making these deterministic across runs.
  3. **Mixed verdict**: small JS + oversized CSS → exit 1, "CSS" in output, no "JS total gzip"
     violation; large JS + tiny CSS → exit 1, "JS" in output, no "CSS total gzip" violation.
  4. **File-count accuracy**: one real JS + one symlinked JS → label reads "1 file checked"; one
     real JS + one `.js`-named directory → label reads "1 file checked".

- Files touched:
  - `/sandbox/work/issue-17/frontend/tests/check-bundle.test.ts`

- Tests: 83 passed before → 91 passed after (8 new coverage tests added, all green, no regressions)

## Iteration 3 — Backend Reliability: safe error handling for I/O failures and directory entries

- Critique: Three failure modes could turn `check-bundle.js` from a clean exit-1 signal into
  a raw Node.js crash with an unformatted stack trace on stderr and an undefined exit code:
  (a) **`fs.readdirSync` EACCES** — `fs.existsSync` checks F_OK (file exists), not R_OK
  (readable). A directory that exists but has mode 000 passes the `existsSync` guard and then
  throws at `readdirSync`. The error was completely uncaught, producing a raw stack trace to
  stderr and an implicitly-set exit code of 1 only by Node's default unhandled-exception
  handler — a fragile contract for CI consumers.
  (b) **`fs.lstatSync` ENOENT / EACCES** — a file deleted in the brief window between
  `readdirSync` and `lstatSync` (race condition) would throw an unhandled error. Same for
  a file added to the directory with no-read permissions.
  (c) **`fs.readFileSync` EISDIR** — `readdirSync` returns all entries including
  subdirectories. A directory whose name ends in `.js` or `.css` (unusual but not impossible,
  e.g. a bundler that co-locates chunks in a same-named folder) passes the `.endsWith`
  filter, passes `lstatSync` as a regular entry (it is not a symlink, not oversized), and
  then causes `readFileSync` to throw `EISDIR`.

- Change: Four targeted additions maintaining the established "warn and continue" pattern:
  1. **`readdirSync` guard in `checkBundles`**: wrapped in try/catch. On failure returns
     `{ ok: false, stderr: "check-bundle: cannot read directory ... (EACCES)\n" }` — clean
     exit 1 with a named message, no raw stack trace.
  2. **`lstatSync` guard in `measureFiles`**: wrapped in try/catch that pushes a warning
     `"check-bundle: skipping <name> (lstat failed: ENOENT)"` and continues to the next
     file. Race conditions no longer crash the process.
  3. **`isDirectory()` guard in `measureFiles`**: explicit check after the symlink check,
     before the size check and `readFileSync`. A `.js`-named directory is warned about and
     skipped; `readFileSync` is never called on it.
  4. **`readFileSync` guard in `measureFiles`**: secondary try/catch for the case where a
     file's permissions change between `lstatSync` and `readFileSync` (toctou). Pushes a
     warning `"check-bundle: skipping <name> (read failed: EACCES)"` and continues.
  Added 3 new tests:
  - `skips a directory entry whose name ends in .js rather than crashing (EISDIR guard)`
  - `skips a directory entry whose name ends in .css rather than crashing (EISDIR guard)`
  - `exits 1 with a named error message when the assets directory is not readable (EACCES)`

- Files touched:
  - `/sandbox/work/issue-17/frontend/scripts/check-bundle.js`
  - `/sandbox/work/issue-17/frontend/tests/check-bundle.test.ts`

- Tests: 80 passed before → 83 passed after (3 new reliability tests added, all green, no regressions)

## Iteration 2 — UX/Product Polish: "0 files checked" label and Next.js path hint on vacuous pass

- Critique: `checkBundles` printed bare `check-bundle PASSED` or the terse "not found — skipping"
  message in two scenarios where it had checked nothing at all:
  (a) **Missing directory** — when `dist/assets/` does not exist (the normal state after
  `next build`, which outputs to `.next/static/chunks/`), the message was
  `check-bundle: <dir> not found — skipping (no assets to check)`. A developer could
  reasonably assume the script ran and verified the build, when in fact it checked zero
  bytes. No actionable hint told them where to point the script for a real Next.js build.
  (b) **Empty or JS/CSS-free directory** — the script printed `check-bundle PASSED` followed
  by raw totals of `0 / 10240 B` and `0 / 4096 B` with no indication that zero files were
  actually measured. A vacuous "PASSED" is indistinguishable from a genuine pass.
  In both scenarios the FAIL path also lacked a file count, making the verdict harder to
  parse at a glance in truncated CI logs.

- Change: Three targeted additions to `checkBundles` in `check-bundle.js`:
  1. **File-count label in every verdict**: both `PASSED` and `FAILED` messages now carry
     `(N files checked)` — e.g. `check-bundle PASSED (2 files checked)` — so the scope of
     the check is visible without reading the summary table.
  2. **Next.js path hint on missing directory**: the "not found" message gains two extra lines
     pointing the developer to `.next/static/chunks` and the correct invocation pattern.
  3. **Next.js path hint on zero checkable files**: when the directory exists but contains no
     `.js` or `.css` files (common when running against the wrong path), a `Hint:` block is
     appended to the PASSED output.
  Added 4 new tests:
  - `prints '0 files checked' and a Next.js path hint when directory does not exist`
  - `prints '0 files checked' and a Next.js path hint when directory has no JS or CSS files`
  - `includes the file count in the PASSED message`
  - `uses singular 'file' when exactly one file is checked`

- Files touched:
  - `/sandbox/work/issue-17/frontend/scripts/check-bundle.js`
  - `/sandbox/work/issue-17/frontend/tests/check-bundle.test.ts`

- Tests: 76 passed before → 80 passed after (4 new UX tests added, all green, no regressions)

## Iteration 1 — Security Hardening: symlink and oversized-file guards in measureFiles

- Critique: `measureFiles` called `fs.readFileSync(filePath)` immediately after `readdirSync`
  without inspecting the filesystem entry. Two concrete foot-guns:
  (a) **Symlink attack** — `readdirSync` returns the symlink name, `readFileSync` follows it.
  A symlink in `dist/assets/` named `evil.js` pointing to `/etc/passwd` or any large file
  outside the directory would be silently read and gzip-compressed. In a CI environment this
  is an information-disclosure and resource-exhaustion risk rolled into one.
  (b) **Resource exhaustion** — there was no size check before loading the file into memory.
  An accidentally large artifact (or a symlink to one) would cause `readFileSync` +
  `gzipSync` to allocate and compress the entire file in a single synchronous call,
  potentially OOM-killing the CI runner process.

- Change: Replaced the `filePaths.map(readFileSync)` approach with an explicit `for` loop
  that calls `fs.lstatSync` (not `statSync`, so symlinks are never followed) before reading
  each file. Two guard conditions are checked in order:
  1. If `stat.isSymbolicLink()` is true, skip the file and push a warning string.
  2. If `stat.size > MAX_RAW_FILE_BYTES` (5 MB), skip the file and push a warning string.
  Warnings are surfaced in stdout so CI logs make the skip visible. `MAX_RAW_FILE_BYTES` is
  exported so tests can reference it without hard-coding the magic number.
  Added three new tests: two covering symlink-skip behaviour for .js and .css, one confirming
  normal files produce no "oversized" warning.

- Files touched:
  - `/sandbox/work/issue-17/frontend/scripts/check-bundle.js`
  - `/sandbox/work/issue-17/frontend/tests/check-bundle.test.ts`

- Tests: 73 passed before → 76 passed after (3 new security tests added, all green, no regressions)
