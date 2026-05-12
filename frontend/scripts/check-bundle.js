#!/usr/bin/env node
// @ts-check
"use strict";

/**
 * check-bundle.js — gzip bundle-size guard
 *
 * Reads all .js and .css files from a dist/assets directory, computes their
 * total gzip sizes, and asserts they fall within the configured budgets:
 *   JS  total gzip ≤ JS_BUDGET  (default 10 240 B = 10 KB)
 *   CSS total gzip ≤ CSS_BUDGET (default  4 096 B =  4 KB)
 *
 * Usage:
 *   node scripts/check-bundle.js [distAssetsDir]
 *
 * If distAssetsDir is omitted, defaults to <cwd>/dist/assets.
 *
 * Exit codes:
 *   0 — all budgets satisfied (or directory does not exist)
 *   1 — one or more budgets exceeded
 */

const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

/** Maximum total gzip size for all .js files (bytes). */
const JS_BUDGET = 10_240;

/** Maximum total gzip size for all .css files (bytes). */
const CSS_BUDGET = 4_096;

/**
 * Maximum raw (uncompressed) file size accepted before gzip measurement (bytes).
 * Files larger than this are skipped with a warning rather than read entirely
 * into memory, preventing resource exhaustion from unexpectedly large artifacts
 * or a symlink that resolves to a huge file.
 * 5 MB is well above any realistic JS/CSS bundle while still being safe.
 */
const MAX_RAW_FILE_BYTES = 5 * 1024 * 1024; // 5 MB

/**
 * Compute the gzip-compressed size of a Buffer.
 * @param {Buffer} content
 * @returns {number}
 */
function gzipSize(content) {
  return zlib.gzipSync(content).length;
}

/**
 * Measure every file in `filePaths` and return per-file sizes + total.
 * Each file is read exactly once.
 *
 * Security guards applied before reading each file:
 *  1. Symlinks are skipped — a symlink in dist/assets could point outside the
 *     directory (e.g. /etc/passwd) or to a device file, both of which are
 *     foot-guns in a CI environment.
 *  2. Files larger than MAX_RAW_FILE_BYTES are skipped with a warning — this
 *     prevents memory exhaustion from unexpectedly large artifacts that somehow
 *     ended up in the assets directory.
 *
 * @param {string[]} filePaths
 * @returns {{ sizes: Array<{name: string; gzip: number}>; total: number; warnings: string[] }}
 */
function measureFiles(filePaths) {
  let total = 0;
  /** @type {string[]} */
  const warnings = [];
  /** @type {Array<{name: string; gzip: number}>} */
  const sizes = [];

  for (const filePath of filePaths) {
    const stat = fs.lstatSync(filePath);

    if (stat.isSymbolicLink()) {
      warnings.push(
        `check-bundle: skipping symlink ${path.basename(filePath)}`
      );
      continue;
    }

    if (stat.size > MAX_RAW_FILE_BYTES) {
      warnings.push(
        `check-bundle: skipping oversized file ${path.basename(filePath)} ` +
          `(${stat.size} B > ${MAX_RAW_FILE_BYTES} B limit)`
      );
      continue;
    }

    const gzip = gzipSize(fs.readFileSync(filePath));
    total += gzip;
    sizes.push({ name: path.basename(filePath), gzip });
  }

  return { sizes, total, warnings };
}

/**
 * Build a violation message listing all files contributing to the budget bust.
 *
 * @param {string} label        "JS" or "CSS"
 * @param {number} total        Total gzip bytes
 * @param {number} budget       Budget limit in bytes
 * @param {Array<{name: string; gzip: number}>} sizes
 * @returns {string}
 */
function violationMessage(label, total, budget, sizes) {
  const fileLines = sizes
    .map((f) => `    ${f.name}: ${f.gzip} B (gzip)`)
    .join("\n");
  return `${label} total gzip: ${total} B exceeds budget ${budget} B\n${fileLines}`;
}

/**
 * Core bundle-check logic.  Exported for direct use in tests.
 *
 * @param {string} distDir  Path to the directory containing .js/.css assets.
 * @returns {{ ok: boolean; stdout: string; stderr: string }}
 */
function checkBundles(distDir) {
  if (!fs.existsSync(distDir)) {
    return {
      ok: true,
      stdout: `check-bundle: ${distDir} not found — skipping (no assets to check)\n`,
      stderr: "",
    };
  }

  const entries = fs.readdirSync(distDir);
  const toAbsolute = (/** @type {string} */ f) => path.join(distDir, f);

  const js = measureFiles(
    entries.filter((f) => f.endsWith(".js")).map(toAbsolute)
  );
  const css = measureFiles(
    entries.filter((f) => f.endsWith(".css")).map(toAbsolute)
  );

  // Collect any security-related skip warnings so they appear in CI logs.
  const allWarnings = [...js.warnings, ...css.warnings];
  const warningBlock =
    allWarnings.length > 0 ? allWarnings.join("\n") + "\n" : "";

  // Summary lines printed on both pass and fail for visibility.
  const summaryLines = [
    ...js.sizes.map((f) => `  JS  ${f.name}: ${f.gzip} B (gzip)`),
    ...css.sizes.map((f) => `  CSS ${f.name}: ${f.gzip} B (gzip)`),
    `  JS  total: ${js.total} / ${JS_BUDGET} B (gzip)`,
    `  CSS total: ${css.total} / ${CSS_BUDGET} B (gzip)`,
  ].join("\n");

  const violations = [];
  if (js.total > JS_BUDGET)
    violations.push(violationMessage("JS", js.total, JS_BUDGET, js.sizes));
  if (css.total > CSS_BUDGET)
    violations.push(violationMessage("CSS", css.total, CSS_BUDGET, css.sizes));

  if (violations.length > 0) {
    return {
      ok: false,
      stdout: warningBlock,
      stderr: `check-bundle FAILED\n${violations.join("\n")}\n\n${summaryLines}\n`,
    };
  }

  return {
    ok: true,
    stdout: `${warningBlock}check-bundle PASSED\n${summaryLines}\n`,
    stderr: "",
  };
}

module.exports = { checkBundles, JS_BUDGET, CSS_BUDGET, MAX_RAW_FILE_BYTES };

// ---------------------------------------------------------------------------
// CLI entry point
// ---------------------------------------------------------------------------
if (require.main === module) {
  const distDir =
    process.argv[2] || path.join(process.cwd(), "dist", "assets");
  const result = checkBundles(distDir);
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  process.exit(result.ok ? 0 : 1);
}
