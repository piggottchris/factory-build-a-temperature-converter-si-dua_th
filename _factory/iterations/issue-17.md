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
