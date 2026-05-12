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

const DIST_HTML    = path.resolve(__dirname, '..', 'dist', 'index.html');
const HEADERS_FILE = path.resolve(__dirname, '..', '_headers');

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
// (_assertSRIAttributes, _readArtefact — not exported, used by check functions and run())

/**
 * Assert that an HTML element carries a valid SRI integrity attribute and
 * crossorigin="anonymous".
 *
 * @param {Element} el   - The DOM element to inspect.
 * @param {string}  desc - Human-readable description used in error messages.
 * @throws {Error} If integrity is missing, does not start with "sha384-", or
 *                 crossorigin is not "anonymous".
 */
function _assertSRIAttributes(el, desc) {
  const integrity = el.getAttribute('integrity');
  if (!integrity) {
    throw new Error(
      `[sri] ${desc} is missing the integrity attribute. ` +
      'Add integrity="sha384-<hash>" to enable Subresource Integrity.'
    );
  }
  if (!integrity.startsWith('sha384-')) {
    throw new Error(
      `[sri] ${desc} has integrity="${integrity}" which does not use sha384. ` +
      'Only sha384 hashes are accepted (e.g. integrity="sha384-<base64>").'
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
 * Run all security checks against the project's build artefacts.
 * Reads dist/index.html and _headers from the filesystem.
 * Prints a pass/fail summary and exits with the appropriate code.
 */
/**
 * Read a file from disk, exiting with code 1 if the file cannot be found.
 *
 * @param {string} filePath - Absolute path to the file.
 * @returns {string} UTF-8 file contents.
 */
function _readArtefact(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch (err) {
    console.error(`[check-security] Cannot read ${filePath}: ${err.message}`);
    process.exit(1);
  }
}

function run() {
  const errors = [];

  // ── Load artefacts ─────────────────────────────────────────────────────────
  const html          = _readArtefact(DIST_HTML);
  const headersContent = _readArtefact(HEADERS_FILE);

  // ── Run checks ────────────────────────────────────────────────────────────
  const checks = [
    () => checkNoInlineStyles(html),
    () => checkNoInlineScripts(html),
    () => checkSRI(html),
    () => checkSecurityHeaders(headersContent),
    () => checkCSP(headersContent),
  ];

  for (const check of checks) {
    try {
      check();
    } catch (err) {
      errors.push(err.message);
    }
  }

  // ── Report ────────────────────────────────────────────────────────────────
  if (errors.length === 0) {
    console.log('[check-security] All checks passed ✓');
    process.exit(0);
  } else {
    console.error(`[check-security] ${errors.length} check(s) failed:\n`);
    errors.forEach((msg) => console.error(`  ✗ ${msg}\n`));
    process.exit(1);
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
};

if (require.main === module) {
  run();
}
