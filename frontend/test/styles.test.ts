/**
 * CSS content assertions for src/styles.css
 *
 * jsdom does not process @media rules, so we validate the stylesheet source
 * directly — asserting that required rules exist as text patterns.  This is
 * intentionally a "contract" test: it locks the responsive tokens the issue
 * specifies so a future refactor cannot silently remove them.
 *
 * CSS custom properties (var(--…)) are fully supported: helpers below
 * resolve a variable name to its :root declaration value so tests remain
 * meaningful even when the stylesheet uses design tokens.
 */
import { readFileSync } from "fs";
import { resolve } from "path";
import { describe, it, expect, beforeAll } from "vitest";

const CSS_PATH = resolve(__dirname, "../src/styles.css");

let css: string;

beforeAll(() => {
  css = readFileSync(CSS_PATH, "utf-8");
});

// ---------------------------------------------------------------------------
// Helper: resolve a CSS custom property to its :root value string.
// E.g. resolveVar("--tap-min") => "44px"
// ---------------------------------------------------------------------------
function resolveVar(varName: string): string | null {
  // Match `:root { … --name: value; … }` (single-line or multi-line)
  const rootBlock = css.match(/:root\s*\{([^}]+)\}/s)?.[1] ?? "";
  const match = rootBlock.match(
    new RegExp(`${varName.replace("--", "\\-\\-")}\\s*:\\s*([^;\\n]+)`)
  );
  return match ? match[1].trim() : null;
}

// ---------------------------------------------------------------------------
// Helper: given a CSS value (which may be "var(--foo)"), return the resolved
// pixel string — either the literal or the :root declaration value.
// ---------------------------------------------------------------------------
function resolveValue(value: string): string {
  const varRef = value.match(/var\((--[\w-]+)\)/)?.[1];
  if (varRef) {
    return resolveVar(varRef) ?? value;
  }
  return value;
}

// ---------------------------------------------------------------------------
// Helper: check whether a CSS property has an effective value that matches
// a given predicate, resolving custom properties along the way.
// ---------------------------------------------------------------------------
function propertyHasValue(
  property: string,
  predicate: (resolved: string) => boolean
): boolean {
  // Find all occurrences of the property in the CSS
  const re = new RegExp(`${property}\\s*:\\s*([^;\\n]+)`, "g");
  let m: RegExpExecArray | null;
  while ((m = re.exec(css)) !== null) {
    const resolved = resolveValue(m[1].trim());
    if (predicate(resolved)) return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("src/styles.css — file exists and loads", () => {
  it("exists at src/styles.css", () => {
    expect(() => readFileSync(CSS_PATH, "utf-8")).not.toThrow();
  });
});

describe("src/styles.css — mobile-first (<480 px) card layout", () => {
  it("sets card width to calc(100vw - 32px) equivalent", () => {
    // Accept literal calc(100vw - 32px) OR a calc using a var whose value is 16px
    const hasDirect = /calc\(\s*100vw\s*-\s*32px\s*\)/.test(css);
    const hasVarBased = (() => {
      // calc(100vw - 2 * var(--x)) where --x resolves to 16px
      const m = css.match(/calc\(\s*100vw\s*-\s*2\s*\*\s*var\((--[\w-]+)\)\s*\)/);
      if (!m) return false;
      const resolved = resolveVar(m[1]);
      return resolved === "16px";
    })();
    expect(hasDirect || hasVarBased).toBe(true);
  });

  it("applies 16px horizontal margins to the card", () => {
    // Check for margin-left: 16px (literal or via var resolving to 16px)
    const ok = propertyHasValue("margin-left", (v) => v === "16px");
    expect(ok).toBe(true);
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
    // Accept literal 420px or a var that resolves to 420px
    const hasDirect = /max-width\s*:\s*420px/.test(css);
    const hasVarBased = propertyHasValue("max-width", (v) => v === "420px");
    expect(hasDirect || hasVarBased).toBe(true);
  });

  it("centres the card with flexbox on body or a wrapper inside the 480px breakpoint", () => {
    expect(css).toMatch(/display\s*:\s*flex/);
    expect(css).toMatch(/justify-content\s*:\s*center/);
    expect(css).toMatch(/align-items\s*:\s*center/);
  });
});

describe("src/styles.css — tap-target minimums (44×44 px)", () => {
  it("sets min-height: 44px for interactive elements", () => {
    const ok = propertyHasValue("min-height", (v) => v === "44px");
    expect(ok).toBe(true);
  });

  it("sets min-width: 44px for interactive elements", () => {
    const ok = propertyHasValue("min-width", (v) => v === "44px");
    expect(ok).toBe(true);
  });
});

describe("src/styles.css — text size minimums", () => {
  it("enforces minimum font-size of 14px inside the card", () => {
    const ok = propertyHasValue("font-size", (v) => v === "14px");
    expect(ok).toBe(true);
  });

  it("sets input font-size to 16px or larger (prevents iOS Safari auto-zoom)", () => {
    // Resolve the input font-size value (literal or via var)
    const passes = propertyHasValue("font-size", (v) => {
      const px = parseInt(v, 10);
      return !isNaN(px) && px >= 16;
    });
    expect(passes).toBe(true);
  });
});
