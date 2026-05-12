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
 * @param {string[]} filePaths
 * @returns {{ sizes: Array<{name: string; gzip: number}>; total: number }}
 */
function measureFiles(filePaths) {
  let total = 0;
  const sizes = filePaths.map((filePath) => {
    const gzip = gzipSize(fs.readFileSync(filePath));
    total += gzip;
    return { name: path.basename(filePath), gzip };
  });
  return { sizes, total };
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
      stdout: "",
      stderr: `check-bundle FAILED\n${violations.join("\n")}\n\n${summaryLines}\n`,
    };
  }

  return {
    ok: true,
    stdout: `check-bundle PASSED\n${summaryLines}\n`,
    stderr: "",
  };
}

module.exports = { checkBundles, JS_BUDGET, CSS_BUDGET };

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
