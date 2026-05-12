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
// Completeness guard — all five headers must appear together
// ---------------------------------------------------------------------------
describe("vercel.json — all five headers present", () => {
  it("includes every required security header", () => {
    const missing = Object.keys(REQUIRED_HEADERS).filter(
      (k) => !allHeaders.has(k),
    );
    expect(missing).toEqual([]);
  });

  it("no required header has an empty value", () => {
    for (const [key, expected] of Object.entries(REQUIRED_HEADERS)) {
      expect(
        allHeaders.get(key),
        `${key} must match required value`,
      ).toBe(expected);
    }
  });
});

// ---------------------------------------------------------------------------
// Hardening headers added in Security Hardening pass
// ---------------------------------------------------------------------------
describe("vercel.json — Strict-Transport-Security", () => {
  it("is present", () => {
    expect(allHeaders.has("Strict-Transport-Security")).toBe(true);
  });

  it("sets a long max-age with includeSubDomains and preload", () => {
    const hsts = allHeaders.get("Strict-Transport-Security") ?? "";
    // max-age must be at least 1 year (31536000 seconds) to qualify for preload list
    const match = hsts.match(/max-age=(\d+)/);
    expect(match).not.toBeNull();
    expect(parseInt(match![1], 10)).toBeGreaterThanOrEqual(31536000);
    expect(hsts).toContain("includeSubDomains");
    expect(hsts).toContain("preload");
  });
});

describe("vercel.json — Cross-Origin-Opener-Policy", () => {
  it("is present", () => {
    expect(allHeaders.has("Cross-Origin-Opener-Policy")).toBe(true);
  });

  it("equals 'same-origin'", () => {
    expect(allHeaders.get("Cross-Origin-Opener-Policy")).toBe("same-origin");
  });
});

describe("vercel.json — Cross-Origin-Resource-Policy", () => {
  it("is present", () => {
    expect(allHeaders.has("Cross-Origin-Resource-Policy")).toBe(true);
  });

  it("equals 'same-origin'", () => {
    expect(allHeaders.get("Cross-Origin-Resource-Policy")).toBe("same-origin");
  });
});
