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
