/**
 * Validates that next.config.mjs exports a headers() function returning all
 * 8 required security headers, ensuring local/Docker dev parity with the
 * Vercel production deployment config in vercel.json.
 *
 * Node environment — no jsdom required.
 */
import { describe, expect, it, beforeAll } from "vitest";
import { resolve } from "path";
import { pathToFileURL } from "url";

// ---------------------------------------------------------------------------
// Types that mirror the Next.js Header shape
// ---------------------------------------------------------------------------
interface NextHeader {
  key: string;
  value: string;
}

interface NextHeaderRule {
  source: string;
  headers: NextHeader[];
}

// ---------------------------------------------------------------------------
// Required header values (exact) — must match vercel.json
// ---------------------------------------------------------------------------
const REQUIRED_HEADERS: Record<string, string> = {
  "Content-Security-Policy":
    "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'none'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "no-referrer",
  "Permissions-Policy":
    "accelerometer=(), camera=(), clipboard-read=(), clipboard-write=(), geolocation=(), gyroscope=(), microphone=(), usb=()",
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Resource-Policy": "same-origin",
};

// ---------------------------------------------------------------------------
// Fixture: load next.config.mjs and evaluate headers()
// ---------------------------------------------------------------------------
let allHeaders: Map<string, string>;

beforeAll(async () => {
  const configPath = resolve(__dirname, "../next.config.mjs");
  const mod = await import(pathToFileURL(configPath).href);
  const nextConfig = mod.default;

  expect(
    typeof nextConfig.headers,
    "next.config.mjs must export a headers() function for local/Docker dev security-header parity",
  ).toBe("function");

  const rules: NextHeaderRule[] = await nextConfig.headers();
  allHeaders = new Map<string, string>();
  for (const rule of rules) {
    for (const h of rule.headers) {
      allHeaders.set(h.key, h.value);
    }
  }
});

// ---------------------------------------------------------------------------
// Structure
// ---------------------------------------------------------------------------
describe("next.config.mjs — headers() structure", () => {
  it("has a catch-all rule matching all paths", async () => {
    const configPath = resolve(__dirname, "../next.config.mjs");
    const mod = await import(pathToFileURL(configPath).href);
    const rules: NextHeaderRule[] = await mod.default.headers();
    const catchAll = rules.find(
      (r) => r.source === "/(.*)" || r.source === "/**",
    );
    expect(
      catchAll,
      "next.config.mjs headers() must contain a catch-all rule ('/(.*)'  or '/**') so all paths receive security headers",
    ).toBeDefined();
  });

  it("catch-all rule source is exactly '/(.*)', matching vercel.json", async () => {
    // Keeps next.config.mjs and vercel.json source patterns in sync. A drift
    // (e.g. '/**' in one but '/(.*)'  in the other) would not be caught by the
    // value-sync test and would cause subtle parity differences.
    const configPath = resolve(__dirname, "../next.config.mjs");
    const mod = await import(pathToFileURL(configPath).href);
    const rules: NextHeaderRule[] = await mod.default.headers();
    const exactCatchAll = rules.find((r) => r.source === "/(.*)");
    expect(
      exactCatchAll,
      "next.config.mjs headers() catch-all rule must use source '/(.*)'  to match vercel.json exactly",
    ).toBeDefined();
  });

  it("no header key appears more than once in the catch-all rule", async () => {
    // Duplicates are silently dropped by the Map flattener; a duplicate would
    // make the first occurrence invisible to value-assertion tests.
    const configPath = resolve(__dirname, "../next.config.mjs");
    const mod = await import(pathToFileURL(configPath).href);
    const rules: NextHeaderRule[] = await mod.default.headers();
    for (const rule of rules) {
      const seen = new Set<string>();
      const duplicates: string[] = [];
      for (const h of rule.headers) {
        if (seen.has(h.key)) duplicates.push(h.key);
        seen.add(h.key);
      }
      expect(
        duplicates,
        `next.config.mjs rule '${rule.source}' has duplicate header keys: ${duplicates.join(", ")}`,
      ).toEqual([]);
    }
  });
});

// ---------------------------------------------------------------------------
// Per-header presence and value — all 8 headers must match vercel.json exactly
// ---------------------------------------------------------------------------
describe("next.config.mjs — all 8 security headers present and correct", () => {
  it("includes every required header", () => {
    const missing = Object.keys(REQUIRED_HEADERS).filter(
      (k) => !allHeaders.has(k),
    );
    expect(
      missing,
      `next.config.mjs headers() is missing headers that vercel.json provides: ${missing.join(", ")}. ` +
        "These headers must be kept in sync so local/Docker dev matches Vercel production.",
    ).toEqual([]);
  });

  it("each header value matches vercel.json exactly", () => {
    for (const [key, expected] of Object.entries(REQUIRED_HEADERS)) {
      expect(
        allHeaders.get(key),
        `next.config.mjs '${key}' value diverges from vercel.json — keep both files in sync`,
      ).toBe(expected);
    }
  });
});
