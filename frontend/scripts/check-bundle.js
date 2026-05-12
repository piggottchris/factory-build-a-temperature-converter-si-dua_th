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
 * Compute the gzip-compressed size of a Buffer or string.
 * @param {Buffer | string} content
 * @returns {number}
 */
function gzipSize(content) {
  return zlib.gzipSync(content).length;
}

/**
 * Core bundle-check logic.  Exported so unit tests can call it directly
 * without spawning a child process.
 *
 * @param {string} distDir  Path to the directory containing .js/.css assets.
 * @returns {{ ok: boolean; stdout: string; stderr: string }}
 */
function checkBundles(distDir) {
  // Directory absent → nothing to check → pass.
  if (!fs.existsSync(distDir)) {
    return {
      ok: true,
      stdout: `check-bundle: ${distDir} not found — skipping (no assets to check)\n`,
      stderr: "",
    };
  }

  const entries = fs.readdirSync(distDir);
  const jsFiles = entries
    .filter((f) => f.endsWith(".js"))
    .map((f) => path.join(distDir, f));
  const cssFiles = entries
    .filter((f) => f.endsWith(".css"))
    .map((f) => path.join(distDir, f));

  /** @type {string[]} */
  const lines = [];
  /** @type {string[]} */
  const violations = [];

  // --- JS ---
  let jsTotalGzip = 0;
  for (const file of jsFiles) {
    const content = fs.readFileSync(file);
    const size = gzipSize(content);
    jsTotalGzip += size;
    lines.push(`  JS  ${path.basename(file)}: ${size} B (gzip)`);
  }
  if (jsTotalGzip > JS_BUDGET) {
    violations.push(
      `JS total gzip: ${jsTotalGzip} B exceeds budget ${JS_BUDGET} B\n` +
        jsFiles
          .map((f) => {
            const sz = gzipSize(fs.readFileSync(f));
            return `    ${path.basename(f)}: ${sz} B (gzip)`;
          })
          .join("\n")
    );
  }

  // --- CSS ---
  let cssTotalGzip = 0;
  for (const file of cssFiles) {
    const content = fs.readFileSync(file);
    const size = gzipSize(content);
    cssTotalGzip += size;
    lines.push(`  CSS ${path.basename(file)}: ${size} B (gzip)`);
  }
  if (cssTotalGzip > CSS_BUDGET) {
    violations.push(
      `CSS total gzip: ${cssTotalGzip} B exceeds budget ${CSS_BUDGET} B\n` +
        cssFiles
          .map((f) => {
            const sz = gzipSize(fs.readFileSync(f));
            return `    ${path.basename(f)}: ${sz} B (gzip)`;
          })
          .join("\n")
    );
  }

  if (violations.length > 0) {
    const stderr =
      `check-bundle FAILED\n` +
      violations.join("\n") +
      "\n\nAll assets scanned:\n" +
      lines.join("\n") +
      "\n";
    return { ok: false, stdout: "", stderr };
  }

  const stdout =
    `check-bundle PASSED\n` +
    lines.join("\n") +
    `\n  JS  total: ${jsTotalGzip} / ${JS_BUDGET} B (gzip)\n` +
    `  CSS total: ${cssTotalGzip} / ${CSS_BUDGET} B (gzip)\n`;
  return { ok: true, stdout, stderr: "" };
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
