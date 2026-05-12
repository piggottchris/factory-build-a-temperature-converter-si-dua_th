/**
 * tests/convert.test.ts — Unit tests for pure functions in src/convert.ts
 *
 * These tests call parseCelsius, celsiusToFahrenheit, celsiusToKelvin, and
 * formatNumber directly (no DOM, no jsdom) to pin each branch and formula.
 */

import { describe, it, expect } from "vitest";
import {
  parseCelsius,
  celsiusToFahrenheit,
  celsiusToKelvin,
  formatNumber,
  CELSIUS_MIN,
  CELSIUS_MAX,
} from "../src/convert.ts";

// ── parseCelsius — empty branch ───────────────────────────────────────────────

describe("parseCelsius — empty", () => {
  it("returns empty for an empty string", () => {
    expect(parseCelsius("")).toEqual({ type: "empty" });
  });

  it("returns empty for whitespace-only string", () => {
    expect(parseCelsius("   ")).toEqual({ type: "empty" });
  });

  it("returns empty for tab-only string", () => {
    expect(parseCelsius("\t")).toEqual({ type: "empty" });
  });
});

// ── parseCelsius — pending branch ─────────────────────────────────────────────

describe("parseCelsius — pending", () => {
  it("returns pending for lone minus sign", () => {
    expect(parseCelsius("-")).toEqual({ type: "pending" });
  });

  it("returns pending for lone plus sign", () => {
    expect(parseCelsius("+")).toEqual({ type: "pending" });
  });

  it("returns pending for lone decimal point", () => {
    expect(parseCelsius(".")).toEqual({ type: "pending" });
  });

  it("returns pending for -. sequence", () => {
    expect(parseCelsius("-.")).toEqual({ type: "pending" });
  });

  it("returns pending for +. sequence", () => {
    expect(parseCelsius("+.")).toEqual({ type: "pending" });
  });

  it("returns pending for trailing E (integer base)", () => {
    expect(parseCelsius("1e")).toEqual({ type: "pending" });
  });

  it("returns pending for trailing E uppercase (integer base)", () => {
    expect(parseCelsius("1E")).toEqual({ type: "pending" });
  });

  it("returns pending for trailing E with decimal base", () => {
    expect(parseCelsius("36.6E")).toEqual({ type: "pending" });
  });

  it("returns pending for E with plus but no exponent digits", () => {
    expect(parseCelsius("1e+")).toEqual({ type: "pending" });
  });

  it("returns pending for E with minus but no exponent digits", () => {
    expect(parseCelsius("1e-")).toEqual({ type: "pending" });
  });

  it("returns pending for negative base trailing E", () => {
    expect(parseCelsius("-1.5e")).toEqual({ type: "pending" });
  });
});

// ── parseCelsius — invalid:format branch ──────────────────────────────────────

describe("parseCelsius — invalid:format", () => {
  it("returns invalid format for alphabetic string", () => {
    expect(parseCelsius("abc")).toEqual({ type: "invalid", reason: "format" });
  });

  it("returns invalid format for mixed alphanumeric", () => {
    expect(parseCelsius("1a2")).toEqual({ type: "invalid", reason: "format" });
  });

  it("returns invalid format for hex literal (0x10)", () => {
    expect(parseCelsius("0x10")).toEqual({ type: "invalid", reason: "format" });
  });

  it("returns invalid format for binary literal (0b10)", () => {
    expect(parseCelsius("0b10")).toEqual({ type: "invalid", reason: "format" });
  });

  it("returns invalid format for octal literal (0o10)", () => {
    expect(parseCelsius("0o10")).toEqual({ type: "invalid", reason: "format" });
  });

  it("returns invalid format for underscore-separated number (1_000)", () => {
    expect(parseCelsius("1_000")).toEqual({ type: "invalid", reason: "format" });
  });

  it("returns invalid format for Infinity literal", () => {
    expect(parseCelsius("Infinity")).toEqual({ type: "invalid", reason: "format" });
  });

  it("returns invalid format for NaN literal", () => {
    expect(parseCelsius("NaN")).toEqual({ type: "invalid", reason: "format" });
  });

  it("returns invalid format for comma-separated number (1,000)", () => {
    expect(parseCelsius("1,000")).toEqual({ type: "invalid", reason: "format" });
  });
});

// ── parseCelsius — invalid:range branch ───────────────────────────────────────

describe("parseCelsius — invalid:range", () => {
  it("returns invalid range for value just above max (1000001)", () => {
    expect(parseCelsius("1000001")).toEqual({ type: "invalid", reason: "range" });
  });

  it("returns invalid range for value just below min (-1000001)", () => {
    expect(parseCelsius("-1000001")).toEqual({ type: "invalid", reason: "range" });
  });

  it("returns invalid range for very large value", () => {
    expect(parseCelsius("9999999")).toEqual({ type: "invalid", reason: "range" });
  });
});

// ── parseCelsius — valid branch ───────────────────────────────────────────────

describe("parseCelsius — valid", () => {
  it("returns valid for integer 100", () => {
    expect(parseCelsius("100")).toEqual({ type: "valid", value: 100 });
  });

  it("returns valid for zero", () => {
    expect(parseCelsius("0")).toEqual({ type: "valid", value: 0 });
  });

  it("returns valid for negative value -40", () => {
    expect(parseCelsius("-40")).toEqual({ type: "valid", value: -40 });
  });

  it("returns valid for decimal value 36.6", () => {
    expect(parseCelsius("36.6")).toEqual({ type: "valid", value: 36.6 });
  });

  it("returns valid for positive sign with value +0.5", () => {
    expect(parseCelsius("+0.5")).toEqual({ type: "valid", value: 0.5 });
  });

  it("returns valid for leading-dot decimal .5", () => {
    expect(parseCelsius(".5")).toEqual({ type: "valid", value: 0.5 });
  });

  it("returns valid for scientific notation 1e6", () => {
    expect(parseCelsius("1e6")).toEqual({ type: "valid", value: 1_000_000 });
  });

  it("returns valid for scientific notation 1E+5", () => {
    expect(parseCelsius("1E+5")).toEqual({ type: "valid", value: 100_000 });
  });

  it("returns valid for boundary max 1000000", () => {
    expect(parseCelsius("1000000")).toEqual({ type: "valid", value: CELSIUS_MAX });
  });

  it("returns valid for boundary min -1000000", () => {
    expect(parseCelsius("-1000000")).toEqual({ type: "valid", value: CELSIUS_MIN });
  });

  it("normalises Unicode minus sign to ASCII hyphen before parsing", () => {
    // U+2212 "−" should be treated the same as ASCII "-"
    expect(parseCelsius("−40")).toEqual({ type: "valid", value: -40 });
  });

  it("trims leading/trailing whitespace before parsing", () => {
    expect(parseCelsius("  100  ")).toEqual({ type: "valid", value: 100 });
  });
});

// ── celsiusToFahrenheit ───────────────────────────────────────────────────────

describe("celsiusToFahrenheit", () => {
  it("converts 0 °C to 32 °F", () => {
    expect(celsiusToFahrenheit(0)).toBe(32);
  });

  it("converts 100 °C to 212 °F", () => {
    expect(celsiusToFahrenheit(100)).toBe(212);
  });

  it("converts -40 °C to -40 °F (the crossover point)", () => {
    expect(celsiusToFahrenheit(-40)).toBe(-40);
  });

  it("converts 1000000 °C to 1800032 °F", () => {
    expect(celsiusToFahrenheit(1_000_000)).toBe(1_800_032);
  });
});

// ── celsiusToKelvin ───────────────────────────────────────────────────────────

describe("celsiusToKelvin", () => {
  it("converts 0 °C to 273.15 K", () => {
    expect(celsiusToKelvin(0)).toBe(273.15);
  });

  it("converts 100 °C to 373.15 K", () => {
    expect(celsiusToKelvin(100)).toBe(373.15);
  });

  it("converts -273.15 °C to 0 K (absolute zero)", () => {
    expect(celsiusToKelvin(-273.15)).toBeCloseTo(0, 10);
  });

  it("converts 1000000 °C to 1000273.15 K", () => {
    expect(celsiusToKelvin(1_000_000)).toBe(1_000_273.15);
  });
});

// ── formatNumber ──────────────────────────────────────────────────────────────

describe("formatNumber", () => {
  it("formats an integer to two decimal places (212 → '212.00')", () => {
    expect(formatNumber(212)).toBe("212.00");
  });

  it("formats a value with two decimals unchanged (373.15 → '373.15')", () => {
    expect(formatNumber(373.15)).toBe("373.15");
  });

  it("formats zero to '0.00'", () => {
    expect(formatNumber(0)).toBe("0.00");
  });

  it("formats a negative value (-40 → '-40.00')", () => {
    expect(formatNumber(-40)).toBe("-40.00");
  });

  it("rounds to two decimal places when needed (1.005 → '1.00' or '1.01')", () => {
    // toFixed rounding is implementation-defined for .5; just ensure two decimal places
    const result = formatNumber(1.005);
    expect(result).toMatch(/^1\.0[01]$/);
  });

  it("formats a large number (1800032 → '1800032.00')", () => {
    expect(formatNumber(1_800_032)).toBe("1800032.00");
  });

  it("formats 1000273.15 K boundary value exactly", () => {
    expect(formatNumber(1_000_273.15)).toBe("1000273.15");
  });
});
