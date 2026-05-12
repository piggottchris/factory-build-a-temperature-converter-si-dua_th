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
    const name = path.basename(filePath);

    /** @type {import("fs").Stats} */
    let stat;
    try {
      stat = fs.lstatSync(filePath);
    } catch (/** @type {any} */ err) {
      // Race condition: file was deleted (ENOENT) or is unreadable (EACCES)
      // between readdirSync and lstatSync. Warn and skip rather than crash.
      warnings.push(
        `check-bundle: skipping ${name} (lstat failed: ${err.code || err.message})`
      );
      continue;
    }

    if (stat.isSymbolicLink()) {
      warnings.push(`check-bundle: skipping symlink ${name}`);
      continue;
    }

    if (stat.isDirectory()) {
      // A directory whose name ends in ".js" or ".css" (unusual but possible)
      // would cause readFileSync to throw EISDIR. Skip it explicitly.
      warnings.push(`check-bundle: skipping directory entry ${name}`);
      continue;
    }

    if (stat.size > MAX_RAW_FILE_BYTES) {
      warnings.push(
        `check-bundle: skipping oversized file ${name} ` +
          `(${stat.size} B > ${MAX_RAW_FILE_BYTES} B limit)`
      );
      continue;
    }

    /** @type {Buffer} */
    let content;
    try {
      content = fs.readFileSync(filePath);
    } catch (/** @type {any} */ err) {
      // File may have been deleted or its permissions changed after lstatSync.
      warnings.push(
        `check-bundle: skipping ${name} (read failed: ${err.code || err.message})`
      );
      continue;
    }

    const gzip = gzipSize(content);
    total += gzip;
    sizes.push({ name, gzip });
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
      stdout:
        `check-bundle: ${distDir} not found — skipping (0 files checked)\n` +
        `  Hint: Next.js builds output to .next/static/chunks/, not dist/assets/.\n` +
        `  To check a Next.js build: node scripts/check-bundle.js .next/static/chunks\n`,
      stderr: "",
    };
  }

  /** @type {string[]} */
  let entries;
  try {
    entries = fs.readdirSync(distDir);
  } catch (/** @type {any} */ err) {
    // Directory exists but cannot be read (e.g. EACCES — permission denied).
    // Return a clean named error rather than crashing with a raw stack trace.
    return {
      ok: false,
      stdout: "",
      stderr: `check-bundle: cannot read directory ${distDir} (${err.code || err.message})\n`,
    };
  }
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

  const fileCount = js.sizes.length + css.sizes.length;
  const fileCountLabel =
    fileCount === 0
      ? "0 files checked"
      : fileCount === 1
      ? "1 file checked"
      : `${fileCount} files checked`;

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
      stderr: `check-bundle FAILED (${fileCountLabel})\n${violations.join("\n")}\n\n${summaryLines}\n`,
    };
  }

  // When zero files were measured (directory exists but holds no .js/.css),
  // surface a hint so developers aren't misled by a vacuous PASSED.
  const zeroFilesHint =
    fileCount === 0
      ? `  Hint: No .js or .css files found in ${distDir}.\n` +
        `  If using Next.js, try: node scripts/check-bundle.js .next/static/chunks\n`
      : "";

  return {
    ok: true,
    stdout: `${warningBlock}check-bundle PASSED (${fileCountLabel})\n${summaryLines}\n${zeroFilesHint}`,
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
