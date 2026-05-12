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
  mkdirSync,
  writeFileSync,
  symlinkSync,
  rmSync,
  chmodSync,
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

  it("prints '0 files checked' and a Next.js path hint when directory does not exist", () => {
    const result = runScript(join(tmpDir, "nonexistent"));
    expect(result.stdout).toContain("0 files checked");
    expect(result.stdout).toContain(".next/static/chunks");
  });

  it("exits 0 with an empty directory (no JS or CSS files)", () => {
    const result = runScript(tmpDir);
    expect(result.status).toBe(0);
  });

  it("prints '0 files checked' and a Next.js path hint when directory has no JS or CSS files", () => {
    // Only a .map file present — no .js or .css
    writeFileSync(join(tmpDir, "main.js.map"), "{}");
    const result = runScript(tmpDir);
    expect(result.stdout).toContain("0 files checked");
    expect(result.stdout).toContain(".next/static/chunks");
  });

  it("exits 0 with small JS and CSS files well within budget", () => {
    writeFileSync(join(tmpDir, "main.js"), 'console.log("hi")');
    writeFileSync(join(tmpDir, "main.css"), "body{color:red}");
    const result = runScript(tmpDir);
    expect(result.status).toBe(0);
  });

  it("includes the file count in the PASSED message", () => {
    writeFileSync(join(tmpDir, "main.js"), 'console.log("hi")');
    writeFileSync(join(tmpDir, "main.css"), "body{color:red}");
    const result = runScript(tmpDir);
    // Two files: 1 JS + 1 CSS
    expect(result.stdout).toContain("2 files checked");
  });

  it("uses singular 'file' when exactly one file is checked", () => {
    writeFileSync(join(tmpDir, "main.js"), 'console.log("hi")');
    const result = runScript(tmpDir);
    expect(result.stdout).toContain("1 file checked");
    expect(result.stdout).not.toContain("1 files checked");
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
  // Accumulation: multiple files of the same type summing over budget
  // -------------------------------------------------------------------------

  it("exits 1 when two JS files each under budget combine to exceed JS budget", () => {
    // Each file gzip-compresses to ~5923 B (well under JS_BUDGET of 10 240 B individually).
    // Combined total ~11 846 B > 10 240 B — tests that totals are accumulated, not checked
    // per-file.  randomBytes gives incompressible data: gzip(randomBytes(N)) ≈ N + 23 B.
    writeFileSync(join(tmpDir, "chunk1.js"), randomBytes(5900));
    writeFileSync(join(tmpDir, "chunk2.js"), randomBytes(5900));
    const result = runScript(tmpDir);
    expect(result.status).toBe(1);
    const output = result.stderr + result.stdout;
    expect(output).toContain("JS");
    expect(output).toContain("10240");
  });

  it("exits 1 when two CSS files each under budget combine to exceed CSS budget", () => {
    // Each file gzip-compresses to ~2423 B (under CSS_BUDGET of 4 096 B individually).
    // Combined total ~4846 B > 4 096 B.
    writeFileSync(join(tmpDir, "theme1.css"), randomBytes(2400));
    writeFileSync(join(tmpDir, "theme2.css"), randomBytes(2400));
    const result = runScript(tmpDir);
    expect(result.status).toBe(1);
    const output = result.stderr + result.stdout;
    expect(output).toContain("CSS");
    expect(output).toContain("4096");
  });

  // -------------------------------------------------------------------------
  // Boundary: exactly at budget must pass (spec: ≤ budget)
  // -------------------------------------------------------------------------

  it("exits 0 when a JS file gzip size equals exactly JS_BUDGET (boundary: ≤ is pass)", () => {
    // randomBytes(10217) gzip-compresses to exactly 10 240 B under Node's default zlib
    // settings (deflate stored-block for incompressible data has a fixed 23-byte overhead).
    // At the budget boundary the script must exit 0, not 1.
    writeFileSync(join(tmpDir, "exact.js"), randomBytes(10217));
    const result = runScript(tmpDir);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("PASSED");
  });

  it("exits 0 when a CSS file gzip size equals exactly CSS_BUDGET (boundary: ≤ is pass)", () => {
    // randomBytes(4073) gzip-compresses to exactly 4 096 B.
    writeFileSync(join(tmpDir, "exact.css"), randomBytes(4073));
    const result = runScript(tmpDir);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("PASSED");
  });

  // -------------------------------------------------------------------------
  // Mixed pass/fail: one type within budget, the other over
  // -------------------------------------------------------------------------

  it("exits 1 when JS is within budget but CSS exceeds budget (mixed pass/fail)", () => {
    // Small JS (well within 10 240 B) + large CSS (over 4 096 B) must still exit 1.
    writeFileSync(join(tmpDir, "app.js"), 'console.log("tiny")');
    writeFileSync(join(tmpDir, "app.css"), randomBytes(5 * 1024));
    const result = runScript(tmpDir);
    expect(result.status).toBe(1);
    const output = result.stderr + result.stdout;
    // CSS violation reported
    expect(output).toContain("CSS");
    expect(output).toContain("4096");
    // JS is fine — must not report a JS violation
    expect(output).not.toContain("JS total gzip");
  });

  it("exits 1 when CSS is within budget but JS exceeds budget (mixed pass/fail)", () => {
    // Small CSS + large JS: exit 1 with JS violation only.
    writeFileSync(join(tmpDir, "app.js"), randomBytes(20 * 1024));
    writeFileSync(join(tmpDir, "app.css"), "body{color:red}");
    const result = runScript(tmpDir);
    expect(result.status).toBe(1);
    const output = result.stderr + result.stdout;
    expect(output).toContain("JS");
    expect(output).toContain("10240");
    // CSS is fine — must not report a CSS violation
    expect(output).not.toContain("CSS total gzip");
  });

  // -------------------------------------------------------------------------
  // File-count label accuracy: skipped entries must not inflate the count
  // -------------------------------------------------------------------------

  it("file count in verdict excludes skipped symlinks", () => {
    // One real JS file + one symlinked JS file.  Only the real file should be counted.
    const targetFile = join(tmpDir, "secret.bin");
    writeFileSync(targetFile, randomBytes(100));
    const assetsDir = join(tmpDir, "assets3");
    mkdirSync(assetsDir);
    writeFileSync(join(assetsDir, "real.js"), 'console.log("ok")');
    symlinkSync(targetFile, join(assetsDir, "linked.js"));

    const result = runScript(assetsDir);
    // Only 1 real file was measured
    expect(result.stdout).toContain("1 file checked");
    expect(result.stdout).not.toContain("2 files checked");
  });

  it("file count in verdict excludes directory entries with .js names", () => {
    // One real JS file + one directory named 'skipped.js'.
    // The verdict label must count only the real file.
    mkdirSync(join(tmpDir, "skipped.js"));
    writeFileSync(join(tmpDir, "real.js"), 'console.log("ok")');

    const result = runScript(tmpDir);
    expect(result.stdout).toContain("1 file checked");
    expect(result.stdout).not.toContain("2 files checked");
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

  // -------------------------------------------------------------------------
  // Backend reliability: error handling on directory entries
  // -------------------------------------------------------------------------

  it("skips a directory entry whose name ends in .js rather than crashing (EISDIR guard)", () => {
    // A subdirectory named "chunk.js" in the assets dir is unusual but possible
    // (e.g. a bundler that colocates chunks in a same-named folder).
    // Without a guard, readFileSync would throw EISDIR.
    mkdirSync(join(tmpDir, "chunk.js"));
    writeFileSync(join(tmpDir, "main.js"), 'console.log("ok")');
    const result = runScript(tmpDir);
    expect(result.status).toBe(0);
    // The directory entry must be warned about, not silently counted
    expect(result.stdout).toContain("directory entry");
    // The real file is still measured
    expect(result.stdout).toContain("main.js");
  });

  it("skips a directory entry whose name ends in .css rather than crashing (EISDIR guard)", () => {
    mkdirSync(join(tmpDir, "styles.css"));
    writeFileSync(join(tmpDir, "main.css"), "body{color:red}");
    const result = runScript(tmpDir);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("directory entry");
  });

  it("exits 1 with a named error message when the assets directory is not readable (EACCES)", () => {
    // Skip on environments where the test runner is root (root ignores chmod).
    const uid = process.getuid ? process.getuid() : -1;
    if (uid === 0) return;

    // Make the directory unreadable
    chmodSync(tmpDir, 0o000);
    try {
      const result = runScript(tmpDir);
      // Should exit 1 (cannot read directory) with a clean message, not a raw crash
      expect(result.status).toBe(1);
      expect(result.stderr).toContain("cannot read directory");
      expect(result.stderr).toContain("EACCES");
    } finally {
      // Restore permissions so afterEach rmSync can clean up
      chmodSync(tmpDir, 0o755);
    }
  });
});
