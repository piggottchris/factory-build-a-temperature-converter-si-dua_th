/**
 * Tests for scripts/check-security.js
 *
 * Covers the five exported check functions:
 *   checkNoInlineStyles   — asserts no <style> tags in HTML
 *   checkNoInlineScripts  — asserts no <script> elements with inline text
 *   checkSRI              — asserts integrity + crossorigin on every external asset
 *   checkSecurityHeaders  — asserts all five required headers present in deploy config
 *   checkCSP              — asserts CSP contains script-src 'self' and lacks unsafe-inline
 */
import { createRequire } from "module";
import { describe, it, expect } from "vitest";

const require = createRequire(import.meta.url);
const {
  checkNoInlineStyles,
  checkNoInlineScripts,
  checkSRI,
  checkSecurityHeaders,
  checkCSP,
  REQUIRED_HEADERS,
} = require("../scripts/check-security.js");

// ─── checkNoInlineStyles ──────────────────────────────────────────────────────

describe("checkNoInlineStyles", () => {
  it("passes on HTML with no <style> tags", () => {
    expect(() =>
      checkNoInlineStyles("<!doctype html><html><head></head><body></body></html>")
    ).not.toThrow();
  });

  it("passes on HTML with only external <link> stylesheets", () => {
    const html = `<html><head>
      <link rel="stylesheet" href="styles.css" integrity="sha384-abc" crossorigin="anonymous" />
    </head></html>`;
    expect(() => checkNoInlineStyles(html)).not.toThrow();
  });

  it("throws when a <style> tag is present", () => {
    const html = "<html><head><style>body { margin: 0; }</style></head></html>";
    expect(() => checkNoInlineStyles(html)).toThrow();
  });

  it("throws with a message mentioning inline style", () => {
    const html = "<html><head><style>h1 { color: red; }</style></head></html>";
    expect(() => checkNoInlineStyles(html)).toThrowError(/inline.style/i);
  });

  it("throws on multiple <style> tags", () => {
    const html =
      "<html><head><style>a{}</style><style>b{}</style></head></html>";
    expect(() => checkNoInlineStyles(html)).toThrow();
  });
});

// ─── checkNoInlineScripts ─────────────────────────────────────────────────────

describe("checkNoInlineScripts", () => {
  it("passes when no <script> tags at all", () => {
    expect(() => checkNoInlineScripts("<html><body></body></html>")).not.toThrow();
  });

  it("passes when every <script> has only a src attribute (empty body)", () => {
    const html = `<html><body>
      <script src="bundle.js" integrity="sha384-abc" crossorigin="anonymous"></script>
    </body></html>`;
    expect(() => checkNoInlineScripts(html)).not.toThrow();
  });

  it("throws when a <script> has inline text content", () => {
    const html = "<html><body><script>alert(1)</script></body></html>";
    expect(() => checkNoInlineScripts(html)).toThrow();
  });

  it("throws with a message mentioning inline script", () => {
    const html = "<html><body><script>console.log('hi')</script></body></html>";
    expect(() => checkNoInlineScripts(html)).toThrowError(/inline.script/i);
  });

  it("throws on whitespace-only inline content (non-empty text node)", () => {
    // A script tag with only whitespace is still technically inline
    // (an empty-body self-closing <script src=...> is the safe form)
    const html = '<html><body><script>   </script></body></html>';
    expect(() => checkNoInlineScripts(html)).toThrow();
  });
});

// ─── checkSRI ─────────────────────────────────────────────────────────────────

describe("checkSRI", () => {
  it("passes when no external scripts or stylesheets are present", () => {
    expect(() => checkSRI("<html><body></body></html>")).not.toThrow();
  });

  it("passes when all external scripts have sha384 integrity and crossorigin", () => {
    const html = `<html><body>
      <script src="bundle.js"
        integrity="sha384-oqVuAfXRKap7fdgcCY5uykM6+R9GqQ8K/uxy9rx7HNQlGYl1kPzQho1wx4JwY8wC"
        crossorigin="anonymous"></script>
    </body></html>`;
    expect(() => checkSRI(html)).not.toThrow();
  });

  it("passes when all external stylesheets have sha384 integrity and crossorigin", () => {
    const html = `<html><head>
      <link rel="stylesheet" href="styles.css"
        integrity="sha384-oqVuAfXRKap7fdgcCY5uykM6+R9GqQ8K/uxy9rx7HNQlGYl1kPzQho1wx4JwY8wC"
        crossorigin="anonymous" />
    </head></html>`;
    expect(() => checkSRI(html)).not.toThrow();
  });

  it("throws when a script src is missing the integrity attribute", () => {
    const html = '<html><body><script src="bundle.js" crossorigin="anonymous"></script></body></html>';
    expect(() => checkSRI(html)).toThrow();
  });

  it("throws with a message mentioning integrity when integrity is missing", () => {
    const html = '<html><body><script src="bundle.js" crossorigin="anonymous"></script></body></html>';
    expect(() => checkSRI(html)).toThrowError(/integrity/i);
  });

  it("throws when integrity does not start with sha384-", () => {
    const html = `<html><body>
      <script src="b.js" integrity="sha256-abc123" crossorigin="anonymous"></script>
    </body></html>`;
    expect(() => checkSRI(html)).toThrowError(/sha384/i);
  });

  it("throws when crossorigin attribute is missing from a script", () => {
    const html = `<html><body>
      <script src="b.js"
        integrity="sha384-oqVuAfXRKap7fdgcCY5uykM6+R9GqQ8K/uxy9rx7HNQlGYl1kPzQho1wx4JwY8wC">
      </script>
    </body></html>`;
    expect(() => checkSRI(html)).toThrowError(/crossorigin/i);
  });

  it("throws when a stylesheet link is missing integrity", () => {
    const html = `<html><head>
      <link rel="stylesheet" href="styles.css" crossorigin="anonymous" />
    </head></html>`;
    expect(() => checkSRI(html)).toThrow();
  });

  it("throws when a stylesheet link is missing crossorigin", () => {
    const html = `<html><head>
      <link rel="stylesheet" href="styles.css"
        integrity="sha384-oqVuAfXRKap7fdgcCY5uykM6+R9GqQ8K/uxy9rx7HNQlGYl1kPzQho1wx4JwY8wC" />
    </head></html>`;
    expect(() => checkSRI(html)).toThrow();
  });

  it("ignores <link> elements that are not stylesheets (e.g. rel=icon)", () => {
    const html = `<html><head>
      <link rel="icon" href="favicon.ico" />
    </head></html>`;
    expect(() => checkSRI(html)).not.toThrow();
  });

  it("ignores <script> tags without a src attribute (data/template blocks)", () => {
    const html = `<html><body>
      <script type="application/json">{"key":"value"}</script>
    </body></html>`;
    // JSON script blocks carry no src, so SRI check does not apply to them
    expect(() => checkSRI(html)).not.toThrow();
  });
});

// ─── checkSecurityHeaders ────────────────────────────────────────────────────

describe("checkSecurityHeaders", () => {
  const allHeaders = (): string =>
    REQUIRED_HEADERS.map((h: string) => `  ${h}: some-value`).join("\n");

  it("exports REQUIRED_HEADERS as an array of 5 strings", () => {
    expect(Array.isArray(REQUIRED_HEADERS)).toBe(true);
    expect(REQUIRED_HEADERS).toHaveLength(5);
    REQUIRED_HEADERS.forEach((h: string) => expect(typeof h).toBe("string"));
  });

  it("passes when all five required header names are present", () => {
    const content = `/*\n${allHeaders()}\n`;
    expect(() => checkSecurityHeaders(content)).not.toThrow();
  });

  it("throws when Content-Security-Policy is missing", () => {
    const content = REQUIRED_HEADERS.filter((h: string) => h !== "Content-Security-Policy")
      .map((h: string) => `  ${h}: v`)
      .join("\n");
    expect(() => checkSecurityHeaders(content)).toThrowError(
      /Content-Security-Policy/
    );
  });

  it("throws when X-Frame-Options is missing", () => {
    const content = REQUIRED_HEADERS.filter((h: string) => h !== "X-Frame-Options")
      .map((h: string) => `  ${h}: v`)
      .join("\n");
    expect(() => checkSecurityHeaders(content)).toThrowError(/X-Frame-Options/);
  });

  it("throws when X-Content-Type-Options is missing", () => {
    const content = REQUIRED_HEADERS.filter(
      (h: string) => h !== "X-Content-Type-Options"
    )
      .map((h: string) => `  ${h}: v`)
      .join("\n");
    expect(() => checkSecurityHeaders(content)).toThrowError(
      /X-Content-Type-Options/
    );
  });

  it("throws when Referrer-Policy is missing", () => {
    const content = REQUIRED_HEADERS.filter((h: string) => h !== "Referrer-Policy")
      .map((h: string) => `  ${h}: v`)
      .join("\n");
    expect(() => checkSecurityHeaders(content)).toThrowError(/Referrer-Policy/);
  });

  it("throws when Permissions-Policy is missing", () => {
    const content = REQUIRED_HEADERS.filter(
      (h: string) => h !== "Permissions-Policy"
    )
      .map((h: string) => `  ${h}: v`)
      .join("\n");
    expect(() => checkSecurityHeaders(content)).toThrowError(/Permissions-Policy/);
  });
});

// ─── checkCSP ────────────────────────────────────────────────────────────────

describe("checkCSP", () => {
  const makeHeaders = (cspValue: string) =>
    `/*\n  Content-Security-Policy: ${cspValue}\n`;

  it("passes when CSP contains script-src 'self' and no unsafe-inline", () => {
    const content = makeHeaders(
      "default-src 'self'; script-src 'self'; style-src 'self'"
    );
    expect(() => checkCSP(content)).not.toThrow();
  });

  it("passes when default-src 'self' covers script-src", () => {
    const content = makeHeaders("default-src 'self'; object-src 'none'");
    expect(() => checkCSP(content)).not.toThrow();
  });

  it("throws when CSP contains 'unsafe-inline'", () => {
    const content = makeHeaders("script-src 'self' 'unsafe-inline'");
    expect(() => checkCSP(content)).toThrowError(/unsafe-inline/i);
  });

  it("throws when neither script-src nor default-src contains 'self'", () => {
    const content = makeHeaders("default-src 'none'; script-src 'nonce-abc123'");
    expect(() => checkCSP(content)).toThrow();
  });

  it("throws when Content-Security-Policy header is absent from the config", () => {
    const content =
      "/*\n  X-Frame-Options: DENY\n  X-Content-Type-Options: nosniff\n";
    expect(() => checkCSP(content)).toThrow();
  });
});
