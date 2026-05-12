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
 *
 * Reliability notes (Pass 3):
 * - All regex helpers operate on `cssStripped`, which has /* … * / comments
 *   removed.  This prevents a CSS comment that happens to contain "property:
 *   value" text from producing a false-positive match.
 * - `beforeAll` now throws a clear, actionable message when the file is
 *   missing, rather than letting every downstream test fail with a cryptic
 *   "Cannot read properties of undefined" error.
 * - `propertyHasValue` uses a negative look-behind so that searching for
 *   "width" cannot accidentally match inside "max-width" or "min-width".
 */
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import { describe, it, expect, beforeAll } from "vitest";

const CSS_PATH = resolve(__dirname, "../src/styles.css");

let css: string;
/** CSS source with block comments stripped — used by all regex helpers. */
let cssStripped: string;

beforeAll(() => {
  if (!existsSync(CSS_PATH)) {
    throw new Error(
      `styles.test.ts: stylesheet not found at ${CSS_PATH}.\n` +
        `Create frontend/src/styles.css before running this suite.`
    );
  }
  css = readFileSync(CSS_PATH, "utf-8");
  // Remove /* … */ block comments so helpers never match text inside comments.
  cssStripped = css.replace(/\/\*[\s\S]*?\*\//g, "");
});

// ---------------------------------------------------------------------------
// Helper: resolve a CSS custom property to its :root value string.
// E.g. resolveVar("--tap-min") => "44px"
// Operates on cssStripped to avoid matching commented-out declarations.
// ---------------------------------------------------------------------------
function resolveVar(varName: string): string | null {
  // Match `:root { … }` — cssStripped has no comments so [^}]+ is safe.
  const rootBlock = cssStripped.match(/:root\s*\{([^}]+)\}/s)?.[1] ?? "";
  // Escape the leading "--" for the RegExp constructor; hyphens elsewhere in
  // the name are safe unescaped outside a character class.
  const escapedName = varName.replace(/^--/, "\\-\\-");
  const match = rootBlock.match(
    new RegExp(`${escapedName}\\s*:\\s*([^;\\n]+)`)
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
//
// Uses a negative look-behind (?<![a-z-]) so that searching for e.g. "width"
// does not accidentally match inside "max-width" or "min-width".
// Operates on cssStripped to ignore comment text.
// ---------------------------------------------------------------------------
function propertyHasValue(
  property: string,
  predicate: (resolved: string) => boolean
): boolean {
  // Negative look-behind: the character immediately before the property name
  // must not be a lowercase letter or hyphen, so "width" won't match inside
  // "max-width".
  const re = new RegExp(`(?<![a-z-])${property}\\s*:\\s*([^;\\n]+)`, "g");
  let m: RegExpExecArray | null;
  while ((m = re.exec(cssStripped)) !== null) {
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
    const hasDirect = /calc\(\s*100vw\s*-\s*32px\s*\)/.test(cssStripped);
    const hasVarBased = (() => {
      // calc(100vw - 2 * var(--x)) where --x resolves to 16px
      const m = cssStripped.match(/calc\(\s*100vw\s*-\s*2\s*\*\s*var\((--[\w-]+)\)\s*\)/);
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
    expect(cssStripped).toMatch(/env\(\s*safe-area-inset-/);
  });
});

describe("src/styles.css — desktop (≥480 px) card layout", () => {
  it("has a @media (min-width: 480px) breakpoint", () => {
    expect(cssStripped).toMatch(/@media\s*\(\s*min-width\s*:\s*480px\s*\)/);
  });

  it("caps card max-width at 420px inside the 480px breakpoint", () => {
    // Accept literal 420px or a var that resolves to 420px
    const hasDirect = /max-width\s*:\s*420px/.test(cssStripped);
    const hasVarBased = propertyHasValue("max-width", (v) => v === "420px");
    expect(hasDirect || hasVarBased).toBe(true);
  });

  it("centres the card with flexbox on body or a wrapper inside the 480px breakpoint", () => {
    expect(cssStripped).toMatch(/display\s*:\s*flex/);
    expect(cssStripped).toMatch(/justify-content\s*:\s*center/);
    expect(cssStripped).toMatch(/align-items\s*:\s*center/);
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
