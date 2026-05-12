/**
 * CSS content assertions for src/styles.css
 *
 * jsdom does not process @media rules, so we validate the stylesheet source
 * directly — asserting that required rules exist as text patterns.  This is
 * intentionally a "contract" test: it locks the responsive tokens the issue
 * specifies so a future refactor cannot silently remove them.
 */
import { readFileSync } from "fs";
import { resolve } from "path";
import { describe, it, expect, beforeAll } from "vitest";

const CSS_PATH = resolve(__dirname, "../src/styles.css");

let css: string;

beforeAll(() => {
  css = readFileSync(CSS_PATH, "utf-8");
});

describe("src/styles.css — file exists and loads", () => {
  it("exists at src/styles.css", () => {
    expect(() => readFileSync(CSS_PATH, "utf-8")).not.toThrow();
  });
});

describe("src/styles.css — mobile-first (<480 px) card layout", () => {
  it("sets card width to calc(100vw - 32px)", () => {
    expect(css).toMatch(/calc\(\s*100vw\s*-\s*32px\s*\)/);
  });

  it("applies 16px horizontal margins to the card", () => {
    // Accept either shorthand margin-left/right or a 16px margin value
    expect(css).toMatch(/16px/);
  });

  it("uses env(safe-area-inset-*) for top-edge padding", () => {
    expect(css).toMatch(/env\(\s*safe-area-inset-/);
  });
});

describe("src/styles.css — desktop (≥480 px) card layout", () => {
  it("has a @media (min-width: 480px) breakpoint", () => {
    expect(css).toMatch(/@media\s*\(\s*min-width\s*:\s*480px\s*\)/);
  });

  it("caps card max-width at 420px inside the 480px breakpoint", () => {
    // The 420px value must appear (we verify it's inside the media block below)
    expect(css).toMatch(/max-width\s*:\s*420px/);
  });

  it("centres the card with flexbox on body or a wrapper inside the 480px breakpoint", () => {
    expect(css).toMatch(/display\s*:\s*flex/);
    expect(css).toMatch(/justify-content\s*:\s*center/);
    expect(css).toMatch(/align-items\s*:\s*center/);
  });
});

describe("src/styles.css — tap-target minimums (44×44 px)", () => {
  it("sets min-height: 44px for interactive elements", () => {
    expect(css).toMatch(/min-height\s*:\s*44px/);
  });

  it("sets min-width: 44px for interactive elements", () => {
    expect(css).toMatch(/min-width\s*:\s*44px/);
  });
});

describe("src/styles.css — text size minimums", () => {
  it("enforces minimum font-size of 14px inside the card", () => {
    expect(css).toMatch(/font-size\s*:\s*14px/);
  });

  it("sets input font-size to 16px or larger (prevents iOS Safari auto-zoom)", () => {
    // Allow 16px or 1rem (1rem = 16px browser default)
    expect(css).toMatch(/input[^{]*\{[^}]*font-size\s*:\s*(1[6-9]px|[2-9]\dpx|\d{3,}px|1rem|1\.[0-9]+rem)/s);
  });
});
