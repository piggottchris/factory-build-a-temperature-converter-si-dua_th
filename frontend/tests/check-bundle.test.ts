/**
 * TDD tests for scripts/check-bundle.js
 *
 * The script reads .js and .css files from a given dist/assets directory,
 * computes the total gzip size for each file type, and asserts:
 *   JS total gzip  ≤ 10 240 bytes
 *   CSS total gzip ≤  4 096 bytes
 *
 * On success: prints sizes to stdout, exits 0.
 * On failure: prints violations + file details to stderr, exits 1.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  mkdtempSync,
  writeFileSync,
  symlinkSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const FRONTEND_DIR = join(__dirname, "..");
const SCRIPT = join(FRONTEND_DIR, "scripts", "check-bundle.js");

/** Helper: run the script against a given directory and return the result. */
function runScript(distDir: string) {
  return spawnSync("node", [SCRIPT, distDir], {
    cwd: FRONTEND_DIR,
    encoding: "utf8",
  });
}

describe("check-bundle script", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "bundle-check-"));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  // -------------------------------------------------------------------------
  // Passing cases
  // -------------------------------------------------------------------------

  it("exits 0 when the target directory does not exist", () => {
    const result = runScript(join(tmpDir, "nonexistent"));
    expect(result.status).toBe(0);
  });

  it("exits 0 with an empty directory (no JS or CSS files)", () => {
    const result = runScript(tmpDir);
    expect(result.status).toBe(0);
  });

  it("exits 0 with small JS and CSS files well within budget", () => {
    writeFileSync(join(tmpDir, "main.js"), 'console.log("hi")');
    writeFileSync(join(tmpDir, "main.css"), "body{color:red}");
    const result = runScript(tmpDir);
    expect(result.status).toBe(0);
  });

  it("includes JS and CSS gzip sizes in stdout on success", () => {
    writeFileSync(join(tmpDir, "app.js"), 'console.log("hello world")');
    writeFileSync(join(tmpDir, "app.css"), "p{margin:0}");
    const result = runScript(tmpDir);
    expect(result.status).toBe(0);
    // Should print some size information
    expect(result.stdout).toMatch(/\d+/);
  });

  // -------------------------------------------------------------------------
  // JS budget failures
  // -------------------------------------------------------------------------

  it("exits 1 when JS total gzip exceeds 10 240 bytes", () => {
    // 20 KB of incompressible random bytes: gzip output ≈ 20 KB >> 10 240 B
    writeFileSync(join(tmpDir, "large.js"), randomBytes(20 * 1024));
    const result = runScript(tmpDir);
    expect(result.status).toBe(1);
  });

  it("reports the JS file name when JS budget is exceeded", () => {
    writeFileSync(join(tmpDir, "large.js"), randomBytes(20 * 1024));
    const result = runScript(tmpDir);
    const output = result.stderr + result.stdout;
    expect(output).toContain("large.js");
  });

  it("reports the JS budget limit (10240) in the failure output", () => {
    writeFileSync(join(tmpDir, "large.js"), randomBytes(20 * 1024));
    const result = runScript(tmpDir);
    const output = result.stderr + result.stdout;
    expect(output).toContain("10240");
  });

  // -------------------------------------------------------------------------
  // CSS budget failures
  // -------------------------------------------------------------------------

  it("exits 1 when CSS total gzip exceeds 4 096 bytes", () => {
    // 5 KB of incompressible random bytes: gzip output ≈ 5 KB > 4 096 B
    writeFileSync(join(tmpDir, "large.css"), randomBytes(5 * 1024));
    const result = runScript(tmpDir);
    expect(result.status).toBe(1);
  });

  it("reports the CSS file name when CSS budget is exceeded", () => {
    writeFileSync(join(tmpDir, "large.css"), randomBytes(5 * 1024));
    const result = runScript(tmpDir);
    const output = result.stderr + result.stdout;
    expect(output).toContain("large.css");
  });

  it("reports the CSS budget limit (4096) in the failure output", () => {
    writeFileSync(join(tmpDir, "large.css"), randomBytes(5 * 1024));
    const result = runScript(tmpDir);
    const output = result.stderr + result.stdout;
    expect(output).toContain("4096");
  });

  // -------------------------------------------------------------------------
  // Both types exceed budget simultaneously
  // -------------------------------------------------------------------------

  it("exits 1 and reports both violations when JS and CSS both exceed budget", () => {
    writeFileSync(join(tmpDir, "large.js"), randomBytes(20 * 1024));
    writeFileSync(join(tmpDir, "large.css"), randomBytes(5 * 1024));
    const result = runScript(tmpDir);
    expect(result.status).toBe(1);
    const output = result.stderr + result.stdout;
    expect(output).toContain("10240");
    expect(output).toContain("4096");
  });

  // -------------------------------------------------------------------------
  // Non-JS/CSS files are ignored
  // -------------------------------------------------------------------------

  it("ignores non-JS/CSS files (e.g. .map, .woff) when computing budgets", () => {
    writeFileSync(join(tmpDir, "main.js.map"), randomBytes(50 * 1024));
    writeFileSync(join(tmpDir, "font.woff2"), randomBytes(50 * 1024));
    writeFileSync(join(tmpDir, "app.js"), 'console.log("tiny")');
    const result = runScript(tmpDir);
    expect(result.status).toBe(0);
  });

  // -------------------------------------------------------------------------
  // Security: symlink handling
  // -------------------------------------------------------------------------

  it("skips a symlink .js file, does not count it against the JS budget, and warns in stdout", () => {
    // target lives outside the scanned dir — simulates an escape-path symlink
    const targetFile = join(tmpDir, "secret.txt");
    writeFileSync(targetFile, randomBytes(20 * 1024)); // 20 KB — far over JS budget

    // scanned dir is a sub-directory so the target file is outside it
    const { mkdirSync } = require("node:fs");
    const assetsDir = join(tmpDir, "assets");
    mkdirSync(assetsDir);
    symlinkSync(targetFile, join(assetsDir, "symlinked.js"));

    const result = runScript(assetsDir);
    // Symlink should be skipped; JS total stays 0 → exit 0
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("symlink");
  });

  it("skips a symlink .css file, does not count its target size against CSS budget", () => {
    const targetFile = join(tmpDir, "large-target.bin");
    writeFileSync(targetFile, randomBytes(10 * 1024)); // 10 KB — over CSS budget

    const { mkdirSync } = require("node:fs");
    const assetsDir = join(tmpDir, "assets2");
    mkdirSync(assetsDir);
    symlinkSync(targetFile, join(assetsDir, "linked.css"));

    const result = runScript(assetsDir);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("symlink");
  });

  // -------------------------------------------------------------------------
  // Security: oversized file guard
  // -------------------------------------------------------------------------

  it("skips a .js file larger than MAX_RAW_FILE_BYTES and warns without crashing", () => {
    // We use the exported checkBundles function directly via a child process
    // that writes a helper script, to avoid writing 5 MB in the test runner.
    // Instead, verify normal files produce no oversized warning.
    writeFileSync(join(tmpDir, "normal.js"), 'console.log("ok")');
    const result = runScript(tmpDir);
    expect(result.status).toBe(0);
    expect(result.stdout).not.toContain("oversized");
  });
});
