'use strict';
/**
 * check-security.js
 *
 * Static CI validator for the temperature-converter POC.
 * Asserts that the deployed HTML and server-response headers satisfy a
 * minimal Content Security Policy baseline.
 *
 * Usage:
 *   node scripts/check-security.js
 *
 * Exit codes:
 *   0 — all checks passed
 *   1 — one or more checks failed (descriptive message printed to stderr)
 *
 * Exported functions (for unit tests):
 *   checkNoInlineStyles(html)
 *   checkNoInlineScripts(html)
 *   checkSRI(html)
 *   checkSecurityHeaders(headersContent)
 *   checkCSP(headersContent)
 */

const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

// ─── File locations ──────────────────────────────────────────────────────────
//
// Defaults are resolved relative to this file's directory so the script works
// regardless of the caller's cwd (important for `npm run check:security` which
// is typically run from frontend/).
//
// Both paths can be overridden via environment variables, which makes it
// possible to point the script at alternative fixtures in CI or tests without
// touching the source tree.

const DIST_HTML    = process.env.CHECK_SECURITY_HTML
  ? path.resolve(process.env.CHECK_SECURITY_HTML)
  : path.resolve(__dirname, '..', 'dist', 'index.html');

const HEADERS_FILE = process.env.CHECK_SECURITY_HEADERS
  ? path.resolve(process.env.CHECK_SECURITY_HEADERS)
  : path.resolve(__dirname, '..', '_headers');

// ─── Constants ───────────────────────────────────────────────────────────────

/**
 * The five HTTP response headers that every deployment must include.
 * checkSecurityHeaders() asserts all five are present in the deploy config.
 */
const REQUIRED_HEADERS = [
  'Content-Security-Policy',
  'X-Frame-Options',
  'X-Content-Type-Options',
  'Referrer-Policy',
  'Permissions-Policy',
];

// ─── Check functions ─────────────────────────────────────────────────────────

/**
 * Assert that the HTML contains no inline <style> tags.
 * A CSP of `style-src 'self'` blocks inline styles; this check prevents them
 * from ever reaching the deployed artefact.
 *
 * @param {string} html - Raw HTML string to validate.
 * @throws {Error} If one or more <style> tags are found.
 */
function checkNoInlineStyles(html) {
  const { document } = new JSDOM(html).window;
  const tags = document.querySelectorAll('style');
  if (tags.length > 0) {
    throw new Error(
      `[inline-style] Found ${tags.length} inline <style> tag(s). ` +
      'Remove all inline styles and use external stylesheets with SRI instead.'
    );
  }
}

/**
 * Assert that no <script> element contains inline text content.
 * Only scripts loaded via a `src` attribute are permitted; inline scripts
 * are blocked by `script-src 'self'` and are a common XSS vector.
 *
 * Note: <script type="application/ld+json"> and similar data-only script
 * blocks with a non-executable MIME type still have textContent. This check
 * flags them intentionally — use <meta> or external JSON endpoints instead.
 *
 * @param {string} html - Raw HTML string to validate.
 * @throws {Error} If any inline <script> (without src) has any text content, or if any
 *                 external <script src> has non-whitespace inline code alongside its src.
 */
function checkNoInlineScripts(html) {
  const { document } = new JSDOM(html).window;
  const scripts = Array.from(document.querySelectorAll('script'));
  for (const script of scripts) {
    const hasSrc = script.hasAttribute('src');
    const content = script.textContent;

    // For inline scripts (no src): ANY content — even whitespace — is a violation
    // because the only safe form is an empty-body external script loaded via src="".
    // For external scripts (has src): only non-whitespace inline code is a violation;
    // pure whitespace between the tags is treated as an HTML formatting artefact.
    const isViolation = hasSrc
      ? content.trim().length > 0
      : content.length > 0;

    if (isViolation) {
      const snippet = content.trim().slice(0, 60) || '(whitespace only)';
      throw new Error(
        `[inline-script] Found a <script> element with inline text content: "${snippet}". ` +
        'All script code must be in external files loaded via src="".'
      );
    }
  }
}

/**
 * Assert that every external script and stylesheet uses Subresource Integrity.
 *
 * For every <script src="..."> and <link rel="stylesheet" href="...">:
 *   - integrity attribute must be present and start with "sha384-"
 *   - crossorigin attribute must equal "anonymous"
 *
 * @param {string} html - Raw HTML string to validate.
 * @throws {Error} If any external asset is missing or has an invalid integrity/crossorigin.
 */
function checkSRI(html) {
  const { document } = new JSDOM(html).window;

  // External scripts (must have src attribute)
  const scripts = Array.from(document.querySelectorAll('script[src]'));
  for (const el of scripts) {
    const src = el.getAttribute('src');
    _assertSRIAttributes(el, `<script src="${src}">`);
  }

  // External stylesheets
  const links = Array.from(
    document.querySelectorAll('link[rel="stylesheet"][href]')
  );
  for (const el of links) {
    const href = el.getAttribute('href');
    _assertSRIAttributes(el, `<link rel="stylesheet" href="${href}">`);
  }
}

/**
 * Assert that all five required security-response-header names appear in the
 * deploy config content (Netlify `_headers`, `vercel.json`, `netlify.toml`, etc.).
 * The check is a case-sensitive substring search for the header name — it does
 * not attempt to parse the specific format.
 *
 * @param {string} headersContent - The raw text of the deploy config file.
 * @throws {Error} If any required header name is absent.
 */
function checkSecurityHeaders(headersContent) {
  const missing = REQUIRED_HEADERS.filter(
    (header) => !headersContent.includes(header)
  );
  if (missing.length > 0) {
    throw new Error(
      `[security-headers] The following required response headers are missing from the deploy config:\n` +
      missing.map((h) => `  - ${h}`).join('\n')
    );
  }
}

/**
 * Assert that the Content-Security-Policy header value meets baseline requirements:
 *   1. The CSP must be present in the deploy config.
 *   2. The CSP must restrict scripts to 'self' (either via script-src or default-src).
 *   3. The CSP must NOT contain 'unsafe-inline'.
 *
 * @param {string} headersContent - The raw text of the deploy config file.
 * @throws {Error} If the CSP is absent, missing 'self' for scripts, or contains 'unsafe-inline'.
 */
function checkCSP(headersContent) {
  // Extract CSP header value (everything after the colon on that line)
  const match = headersContent.match(/Content-Security-Policy\s*:\s*(.+)/i);
  if (!match) {
    throw new Error(
      "[csp] Content-Security-Policy header not found in deploy config. " +
      "Add a CSP header with at minimum: script-src 'self'"
    );
  }

  const cspValue = match[1].trim();

  if (cspValue.includes("'unsafe-inline'")) {
    throw new Error(
      "[csp] Content-Security-Policy contains 'unsafe-inline', which defeats XSS protection. " +
      "Remove 'unsafe-inline' from the CSP."
    );
  }

  // script-src 'self' may be set directly or inherited from default-src
  const hasScriptSrcSelf =
    /script-src\s[^;]*'self'/.test(cspValue) ||
    /default-src\s[^;]*'self'/.test(cspValue);

  if (!hasScriptSrcSelf) {
    throw new Error(
      "[csp] Content-Security-Policy does not restrict scripts to 'self'. " +
      "Add script-src 'self' (or set default-src 'self') to prevent loading scripts from untrusted origins."
    );
  }
}

// ─── Internal helpers ─────────────────────────────────────────────────────────
// (_assertSRIAttributes — internal; _readArtefact — exported for test use)

/**
 * A sha384 hash encodes 48 bytes as standard base64 (no padding needed since
 * 48 % 3 === 0), yielding exactly 64 characters from the alphabet [A-Za-z0-9+/].
 * Requiring this exact format prevents the CI check from silently accepting a
 * malformed placeholder such as integrity="sha384-" or integrity="sha384-abc".
 */
const SHA384_INTEGRITY_RE = /^sha384-[A-Za-z0-9+/]{64}$/;

/**
 * Assert that an HTML element carries a valid SRI integrity attribute and
 * crossorigin="anonymous".
 *
 * @param {Element} el   - The DOM element to inspect.
 * @param {string}  desc - Human-readable description used in error messages.
 * @throws {Error} If integrity is missing, does not match the sha384 format
 *                 (prefix + exactly 64 standard-base64 chars), or crossorigin
 *                 is not "anonymous".
 */
function _assertSRIAttributes(el, desc) {
  const integrity = el.getAttribute('integrity');
  if (!integrity) {
    throw new Error(
      `[sri] ${desc} is missing the integrity attribute. ` +
      'Add integrity="sha384-<hash>" to enable Subresource Integrity.'
    );
  }
  if (!SHA384_INTEGRITY_RE.test(integrity)) {
    throw new Error(
      `[sri] ${desc} has integrity="${integrity}" which is not a valid sha384 hash. ` +
      'The value must be "sha384-" followed by exactly 64 standard-base64 characters ' +
      '(e.g. integrity="sha384-<base64>"). Generate it with: ' +
      'openssl dgst -sha384 -binary <file> | openssl base64 -A'
    );
  }
  const crossorigin = el.getAttribute('crossorigin');
  if (crossorigin !== 'anonymous') {
    throw new Error(
      `[sri] ${desc} is missing crossorigin="anonymous". ` +
      'Add crossorigin="anonymous" alongside the integrity attribute.'
    );
  }
}

// ─── CLI runner ───────────────────────────────────────────────────────────────

/**
 * Read a file from disk, throwing an Error if the file cannot be read.
 *
 * Throwing (rather than calling process.exit) keeps this function usable as
 * library code: callers in test harnesses or programmatic contexts get a
 * catchable error instead of having the entire process terminated under them.
 * The CLI entry point (see below) is the only site that translates an
 * uncaught Error into a process.exit(1).
 *
 * @param {string} filePath - Absolute path to the file.
 * @returns {string} UTF-8 file contents.
 * @throws {Error} If the file cannot be opened or read.
 */
function _readArtefact(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch (err) {
    throw new Error(`[check-security] Cannot read ${filePath}: ${err.message}`);
  }
}

/**
 * Run all security checks against the project's build artefacts.
 * Reads dist/index.html and _headers from the filesystem.
 * Prints a pass/fail summary to stdout/stderr.
 *
 * @returns {boolean} true if all checks passed, false otherwise.
 *
 * Callers are responsible for translating the return value into an exit code.
 * This lets run() be called from test harnesses without risking a
 * process.exit() killing the test runner.
 */
function run() {
  const errors = [];
  let passed = 0;

  // ── Load artefacts ─────────────────────────────────────────────────────────
  let html, headersContent;
  try {
    html = _readArtefact(DIST_HTML);
  } catch (err) {
    console.error(err.message);
    return false;
  }
  try {
    headersContent = _readArtefact(HEADERS_FILE);
  } catch (err) {
    console.error(err.message);
    return false;
  }

  // ── Run checks ────────────────────────────────────────────────────────────
  const checks = [
    { name: 'no-inline-styles',   fn: () => checkNoInlineStyles(html) },
    { name: 'no-inline-scripts',  fn: () => checkNoInlineScripts(html) },
    { name: 'sri-attributes',     fn: () => checkSRI(html) },
    { name: 'security-headers',   fn: () => checkSecurityHeaders(headersContent) },
    { name: 'csp-policy',         fn: () => checkCSP(headersContent) },
  ];

  for (const { name, fn } of checks) {
    try {
      fn();
      passed++;
      console.log(`  ✓  ${name}`);
    } catch (err) {
      errors.push({ name, message: err.message });
      console.error(`  ✗  ${name}`);
    }
  }

  // ── Report ────────────────────────────────────────────────────────────────
  const total = checks.length;
  if (errors.length === 0) {
    console.log(`\n[check-security] ${passed}/${total} checks passed`);
    return true;
  } else {
    console.error(`\n[check-security] ${passed}/${total} checks passed, ${errors.length} failed:\n`);
    errors.forEach(({ name, message }) => console.error(`  ${name}: ${message}\n`));
    return false;
  }
}

// ─── Exports & entry point ────────────────────────────────────────────────────

module.exports = {
  checkNoInlineStyles,
  checkNoInlineScripts,
  checkSRI,
  checkSecurityHeaders,
  checkCSP,
  REQUIRED_HEADERS,
  run,
  _readArtefact,
};

if (require.main === module) {
  const arg = process.argv[2];
  if (arg === '--help' || arg === '-h') {
    console.log([
      '',
      'Usage: node scripts/check-security.js [--help]',
      '',
      'Static CI validator for the temperature-converter POC.',
      'Reads dist/index.html and _headers relative to the frontend/ directory.',
      '',
      'Checks (run in order):',
      '  no-inline-styles   — no <style> tags in dist/index.html',
      '  no-inline-scripts  — no inline <script> content in dist/index.html',
      '  sri-attributes     — all external assets carry integrity="sha384-…" + crossorigin="anonymous"',
      '  security-headers   — all 5 required headers present in _headers',
      '  csp-policy         — CSP contains script-src \'self\' and omits \'unsafe-inline\'',
      '',
      'Exit codes:',
      '  0  all checks passed',
      '  1  one or more checks failed (details printed to stderr)',
      '',
    ].join('\n'));
    process.exit(0);
  }
  // run() returns true on success; translate to POSIX exit code here, keeping
  // process.exit() out of library code so tests can call run() without risk of
  // terminating the test runner.
  process.exit(run() ? 0 : 1);
}
