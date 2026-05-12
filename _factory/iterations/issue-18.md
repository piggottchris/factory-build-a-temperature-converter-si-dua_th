## Iteration 1 — Security Hardening: tighten SRI hash validation to reject malformed integrity values

- Critique: `_assertSRIAttributes` in `scripts/check-security.js` only checked that the `integrity` attribute started with the string `"sha384-"`. It did not validate the base64 payload that follows the prefix. An `integrity="sha384-"` (empty hash), `integrity="sha384-abc"` (too short), or `integrity="sha384-AAAA...="` (wrong alphabet) all silently passed the CI gate. A sha384 digest is 48 bytes, which encodes to exactly 64 standard-base64 characters (`[A-Za-z0-9+/]`) with no padding (48 % 3 === 0). The old `startsWith` check provided a false sense of security — the gate said "SRI is configured correctly" even for hashes the browser would reject. The bug was already present in `dist/index.html`: the JS bundle placeholder hash was only 62 characters long, which the old check silently accepted.
- Change: Replaced the `integrity.startsWith('sha384-')` test with a strict regex `SHA384_INTEGRITY_RE = /^sha384-[A-Za-z0-9+/]{64}$/`. Updated the error message to explain the correct format and provide the `openssl` command to generate a valid hash. Fixed the malformed 62-character placeholder hash in `dist/index.html` (extended to 64 chars). Added 4 new Vitest tests covering: empty hash (`sha384-`), too-short hash (`sha384-abc`), padding character present (`=` in final position), and a correctly-formed 64-char hash.
- Files touched:
  - `frontend/scripts/check-security.js` — `_assertSRIAttributes` + new `SHA384_INTEGRITY_RE` constant
  - `frontend/dist/index.html` — corrected JS bundle placeholder hash from 62 to 64 chars
  - `frontend/test/check-security.test.ts` — 4 new tests for the stricter validation
- Tests: 154 passed / 0 failed before; 158 passed / 0 failed after
