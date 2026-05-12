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
