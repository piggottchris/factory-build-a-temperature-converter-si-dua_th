/**
 * Static validation of vercel.json security headers.
 *
 * Reads the file from the repo root and asserts that every required header
 * is present and carries the exact value mandated by issue #16.
 *
 * Node environment — no jsdom required.
 */
import { readFileSync } from "fs";
import { resolve } from "path";
import { describe, expect, it, beforeAll } from "vitest";

// ---------------------------------------------------------------------------
// Types that model the vercel.json headers section
// ---------------------------------------------------------------------------
interface VercelHeader {
  key: string;
  value: string;
}

interface VercelHeaderRule {
  source: string;
  headers: VercelHeader[];
}

interface VercelConfig {
  headers?: VercelHeaderRule[];
}

// ---------------------------------------------------------------------------
// Required header values (exact)
// ---------------------------------------------------------------------------
const REQUIRED_HEADERS: Record<string, string> = {
  "Content-Security-Policy":
    "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'none'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "no-referrer",
  "Permissions-Policy":
    "accelerometer=(), camera=(), clipboard-read=(), clipboard-write=(), geolocation=(), gyroscope=(), microphone=(), usb=()",
};

// ---------------------------------------------------------------------------
// Fixture: load vercel.json once
// ---------------------------------------------------------------------------
let config: VercelConfig;
let allHeaders: Map<string, string>;

beforeAll(() => {
  // Test runs from frontend/; vercel.json is one level up (repo root).
  const configPath = resolve(__dirname, "../../vercel.json");
  const raw = readFileSync(configPath, "utf-8");
  config = JSON.parse(raw) as VercelConfig;

  // Flatten all header entries across all rules into a single map
  // (key → value), so assertions stay simple.
  allHeaders = new Map<string, string>();
  for (const rule of config.headers ?? []) {
    for (const h of rule.headers) {
      allHeaders.set(h.key, h.value);
    }
  }
});

// ---------------------------------------------------------------------------
// Structure tests
// ---------------------------------------------------------------------------
describe("vercel.json — structure", () => {
  it("has a 'headers' array", () => {
    expect(Array.isArray(config.headers)).toBe(true);
    expect((config.headers ?? []).length).toBeGreaterThan(0);
  });

  it("has at least one catch-all rule matching all paths", () => {
    const catchAll = (config.headers ?? []).find(
      (r) => r.source === "/(.*)" || r.source === "/**",
    );
    expect(catchAll).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Edge-case / robustness tests
// ---------------------------------------------------------------------------
describe("vercel.json — edge cases", () => {
  it("catch-all rule source is exactly '/(.*)', not a looser pattern", () => {
    // The spec mandates '/(.*)'  specifically. Vercel interprets '/(.*)'  as
    // a regex that matches every path including '/'. Using '/**' or '/' alone
    // would miss some paths. This test pins the exact pattern required.
    const exactCatchAll = (config.headers ?? []).find(
      (r) => r.source === "/(.*)",
    );
    expect(
      exactCatchAll,
      "vercel.json catch-all rule must use source '/(.*)'  exactly " +
        "(not '/**' or '/' alone) — '/(.*)'  is the form specified in the product contract",
    ).toBeDefined();
  });

  it("no header key appears more than once within the same rule", () => {
    // Duplicate keys inside a single rule are silently lost because the
    // flattening Map keeps only the last occurrence. A duplicate would make
    // the earlier header completely invisible to the value-assertion tests.
    for (const rule of config.headers ?? []) {
      const seen = new Set<string>();
      const duplicates: string[] = [];
      for (const h of rule.headers) {
        if (seen.has(h.key)) {
          duplicates.push(h.key);
        }
        seen.add(h.key);
      }
      expect(
        duplicates,
        `Rule with source '${rule.source}' has duplicate header keys: ${duplicates.join(", ")}. ` +
          "Duplicate keys cause earlier entries to be silently ignored by the Map flattener in tests and by some CDNs.",
      ).toEqual([]);
    }
  });

  it("catch-all rule has exactly 8 header entries — no accidental additions or deletions", () => {
    // Pin the expected count so that adding a 9th header (or accidentally
    // removing one) is immediately visible rather than silent.
    const catchAll = (config.headers ?? []).find(
      (r) => r.source === "/(.*)" || r.source === "/**",
    );
    expect(catchAll).toBeDefined();
    expect(
      catchAll!.headers.length,
      `Expected exactly 8 security headers in the catch-all rule, ` +
        `but found ${catchAll!.headers.length}. ` +
        "Update this test intentionally when adding or removing a header.",
    ).toBe(8);
  });

  it("all required header keys use canonical HTTP Title-Case, not lowercase", () => {
    // HTTP/1.1 header names are case-insensitive on the wire, but vercel.json
    // key values are sent verbatim. Some downstream tooling (log parsers,
    // security scanners) is case-sensitive. Pinning canonical casing prevents
    // silent drift (e.g. 'content-security-policy' instead of
    // 'Content-Security-Policy').
    const CANONICAL_KEYS = Object.keys(REQUIRED_HEADERS);
    for (const canonical of CANONICAL_KEYS) {
      const lowered = canonical.toLowerCase();
      // The header must be present under its canonical casing
      expect(
        allHeaders.has(canonical),
        `'${canonical}' is missing or misspelled in vercel.json (checked canonical case)`,
      ).toBe(true);
      // If a lowercased variant is also present AND differs from canonical,
      // that is a second entry with wrong casing — flag it.
      if (lowered !== canonical && allHeaders.has(lowered)) {
        throw new Error(
          `Header '${lowered}' found in vercel.json with wrong casing — ` +
            `use '${canonical}' instead.`,
        );
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Per-header value tests
// ---------------------------------------------------------------------------
describe("vercel.json — Content-Security-Policy", () => {
  it("is present", () => {
    expect(allHeaders.has("Content-Security-Policy")).toBe(true);
  });

  it("has the exact required value", () => {
    expect(allHeaders.get("Content-Security-Policy")).toBe(
      REQUIRED_HEADERS["Content-Security-Policy"],
    );
  });
});

describe("vercel.json — X-Content-Type-Options", () => {
  it("is present", () => {
    expect(allHeaders.has("X-Content-Type-Options")).toBe(true);
  });

  it("equals 'nosniff'", () => {
    expect(allHeaders.get("X-Content-Type-Options")).toBe("nosniff");
  });
});

describe("vercel.json — X-Frame-Options", () => {
  it("is present", () => {
    expect(allHeaders.has("X-Frame-Options")).toBe(true);
  });

  it("equals 'DENY'", () => {
    expect(allHeaders.get("X-Frame-Options")).toBe("DENY");
  });
});

describe("vercel.json — Referrer-Policy", () => {
  it("is present", () => {
    expect(allHeaders.has("Referrer-Policy")).toBe(true);
  });

  it("equals 'no-referrer'", () => {
    expect(allHeaders.get("Referrer-Policy")).toBe("no-referrer");
  });
});

describe("vercel.json — Permissions-Policy", () => {
  it("is present", () => {
    expect(allHeaders.has("Permissions-Policy")).toBe(true);
  });

  it("has the exact required value", () => {
    expect(allHeaders.get("Permissions-Policy")).toBe(
      REQUIRED_HEADERS["Permissions-Policy"],
    );
  });
});

// ---------------------------------------------------------------------------
// Completeness guard — all five contract headers must appear together
// (The three hardening headers added in Security Hardening pass are tested
//  separately below. This block guards only the original five contract headers.)
// ---------------------------------------------------------------------------
describe("vercel.json — all five contract headers present", () => {
  it("includes every required contract header", () => {
    const missing = Object.keys(REQUIRED_HEADERS).filter(
      (k) => !allHeaders.has(k),
    );
    expect(
      missing,
      `Missing contract headers: ${missing.join(", ")}`,
    ).toEqual([]);
  });

  it("no contract header has an empty or wrong value", () => {
    for (const [key, expected] of Object.entries(REQUIRED_HEADERS)) {
      expect(
        allHeaders.get(key),
        `${key} must match exact contract value`,
      ).toBe(expected);
    }
  });
});

// ---------------------------------------------------------------------------
// Hardening headers added in Security Hardening pass
// ---------------------------------------------------------------------------
describe("vercel.json — Strict-Transport-Security", () => {
  it("is present", () => {
    expect(
      allHeaders.has("Strict-Transport-Security"),
      "Strict-Transport-Security header is missing from vercel.json",
    ).toBe(true);
  });

  it("sets a long max-age with includeSubDomains and preload", () => {
    const hsts = allHeaders.get("Strict-Transport-Security") ?? "";
    // max-age must be at least 1 year (31536000 seconds) to qualify for preload list
    const match = hsts.match(/max-age=(\d+)/);
    expect(match, "Strict-Transport-Security must contain max-age=<seconds>").not.toBeNull();
    expect(
      parseInt(match![1], 10),
      "HSTS max-age must be >= 31536000 (1 year) to qualify for browser preload list",
    ).toBeGreaterThanOrEqual(31536000);
    expect(hsts, "HSTS must include 'includeSubDomains'").toContain("includeSubDomains");
    expect(hsts, "HSTS must include 'preload'").toContain("preload");
  });
});

describe("vercel.json — Cross-Origin-Opener-Policy", () => {
  it("is present", () => {
    expect(
      allHeaders.has("Cross-Origin-Opener-Policy"),
      "Cross-Origin-Opener-Policy header is missing from vercel.json",
    ).toBe(true);
  });

  it("equals 'same-origin'", () => {
    expect(
      allHeaders.get("Cross-Origin-Opener-Policy"),
      "Cross-Origin-Opener-Policy must be 'same-origin' to isolate the browsing context",
    ).toBe("same-origin");
  });
});

describe("vercel.json — Cross-Origin-Resource-Policy", () => {
  it("is present", () => {
    expect(
      allHeaders.has("Cross-Origin-Resource-Policy"),
      "Cross-Origin-Resource-Policy header is missing from vercel.json",
    ).toBe(true);
  });

  it("equals 'same-origin'", () => {
    expect(
      allHeaders.get("Cross-Origin-Resource-Policy"),
      "Cross-Origin-Resource-Policy must be 'same-origin' to block cross-origin no-CORS reads",
    ).toBe("same-origin");
  });
});
