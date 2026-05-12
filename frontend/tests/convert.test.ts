/**
 * Unit tests for the temperature-converter utility: parser, math, formatter.
 * Node environment — no jsdom required.
 */
import { describe, expect, it } from "vitest";
import {
  parseTemperature,
  celsiusToFahrenheit,
  celsiusToKelvin,
  formatNumber,
  isEmptyResult,
  isPendingResult,
  isValidResult,
  isInvalidResult,
  MAX_ABS,
  MAX_LENGTH,
} from "../lib/convert";

// ---------------------------------------------------------------------------
// Parser
// ---------------------------------------------------------------------------

describe("parseTemperature — empty inputs", () => {
  it("returns empty for an empty string", () => {
    expect(parseTemperature("")).toEqual({ status: "empty" });
  });

  it("returns empty for a whitespace-only string", () => {
    expect(parseTemperature("   ")).toEqual({ status: "empty" });
  });
});

describe("parseTemperature — pending inputs", () => {
  it("returns pending for a lone minus sign", () => {
    expect(parseTemperature("-")).toEqual({ status: "pending" });
  });

  it("returns pending for a lone decimal point", () => {
    expect(parseTemperature(".")).toEqual({ status: "pending" });
  });

  it("returns pending for minus-then-decimal", () => {
    expect(parseTemperature("-.")).toEqual({ status: "pending" });
  });

  it("returns pending for -0 (user may continue typing)", () => {
    expect(parseTemperature("-0")).toEqual({ status: "pending" });
  });

  it("returns pending for a number ending in a decimal point (1.)", () => {
    expect(parseTemperature("1.")).toEqual({ status: "pending" });
  });

  it("returns pending for a negative number ending in a decimal point (-1.)", () => {
    expect(parseTemperature("-1.")).toEqual({ status: "pending" });
  });
});

describe("parseTemperature — valid inputs", () => {
  it("parses '0'", () => {
    expect(parseTemperature("0")).toEqual({ status: "valid", value: 0 });
  });

  it("parses '100'", () => {
    expect(parseTemperature("100")).toEqual({ status: "valid", value: 100 });
  });

  it("parses '-40'", () => {
    expect(parseTemperature("-40")).toEqual({ status: "valid", value: -40 });
  });

  it("parses '36.6'", () => {
    expect(parseTemperature("36.6")).toEqual({ status: "valid", value: 36.6 });
  });

  it("parses '.5' (leading-dot decimal)", () => {
    expect(parseTemperature(".5")).toEqual({ status: "valid", value: 0.5 });
  });

  it("parses '-.5' (negative leading-dot decimal)", () => {
    expect(parseTemperature("-.5")).toEqual({ status: "valid", value: -0.5 });
  });

  it("trims leading whitespace before parsing", () => {
    expect(parseTemperature("  42")).toEqual({ status: "valid", value: 42 });
  });

  it("trims trailing whitespace before parsing", () => {
    expect(parseTemperature("42  ")).toEqual({ status: "valid", value: 42 });
  });

  it("trims both leading and trailing whitespace", () => {
    expect(parseTemperature("  -10.5  ")).toEqual({ status: "valid", value: -10.5 });
  });
});

describe("parseTemperature — invalid: format", () => {
  it("rejects purely alphabetic input", () => {
    expect(parseTemperature("abc")).toEqual({ status: "invalid", reason: "format" });
  });

  it("rejects alpha-suffix on a number", () => {
    expect(parseTemperature("12abc")).toEqual({ status: "invalid", reason: "format" });
  });

  it("rejects multiple decimal points", () => {
    expect(parseTemperature("1.2.3")).toEqual({ status: "invalid", reason: "format" });
  });

  it("rejects double minus", () => {
    expect(parseTemperature("--5")).toEqual({ status: "invalid", reason: "format" });
  });

  it("rejects comma as decimal separator", () => {
    expect(parseTemperature("1,5")).toEqual({ status: "invalid", reason: "format" });
  });

  it("rejects scientific notation (1e2)", () => {
    expect(parseTemperature("1e2")).toEqual({ status: "invalid", reason: "format" });
  });

  it("rejects scientific notation with negative exponent (2.5e-3)", () => {
    expect(parseTemperature("2.5e-3")).toEqual({ status: "invalid", reason: "format" });
  });

  it("rejects a string of length 33 (too long)", () => {
    const longString = "1".repeat(33);
    expect(parseTemperature(longString)).toEqual({ status: "invalid", reason: "format" });
  });
});

describe("parseTemperature — invalid: range", () => {
  it("rejects 1 500 000 (exceeds upper bound)", () => {
    expect(parseTemperature("1500000")).toEqual({ status: "invalid", reason: "range" });
  });

  it("rejects -1 000 001 (exceeds lower bound)", () => {
    expect(parseTemperature("-1000001")).toEqual({ status: "invalid", reason: "range" });
  });
});

// ---------------------------------------------------------------------------
// Math
// ---------------------------------------------------------------------------

describe("celsiusToFahrenheit", () => {
  it("converts boiling point: 100 °C → 212 °F", () => {
    expect(celsiusToFahrenheit(100)).toBe(212);
  });

  it("converts the crossover point: -40 °C → -40 °F", () => {
    expect(celsiusToFahrenheit(-40)).toBe(-40);
  });

  it("converts freezing point: 0 °C → 32 °F", () => {
    expect(celsiusToFahrenheit(0)).toBe(32);
  });
});

describe("celsiusToKelvin", () => {
  it("converts absolute zero reference: 0 °C → 273.15 K", () => {
    expect(celsiusToKelvin(0)).toBe(273.15);
  });

  it("converts boiling point: 100 °C → 373.15 K", () => {
    expect(celsiusToKelvin(100)).toBe(373.15);
  });

  it("converts crossover temperature: -40 °C → 233.15 K (IEEE 754 drift guard)", () => {
    // Raw addition (-40 + 273.15) produces 233.14999999999998 in IEEE 754.
    // The implementation must return exactly 233.15.
    expect(celsiusToKelvin(-40)).toBe(233.15);
  });
});

// ---------------------------------------------------------------------------
// Formatter
// ---------------------------------------------------------------------------

describe("formatNumber", () => {
  it("formats an integer with two decimal places", () => {
    expect(formatNumber(212)).toBe("212.00");
  });

  it("formats negative zero as '0.00' (not '-0.00')", () => {
    expect(formatNumber(-0)).toBe("0.00");
  });

  it("rounds 97.875 correctly (half-away-from-zero → 97.88)", () => {
    expect(formatNumber(97.875)).toBe("97.88");
  });

  it("formats 0 as '0.00'", () => {
    expect(formatNumber(0)).toBe("0.00");
  });

  it("formats a negative value with two decimal places", () => {
    expect(formatNumber(-40)).toBe("-40.00");
  });

  it("formats a small positive decimal", () => {
    expect(formatNumber(0.5)).toBe("0.50");
  });

  it("formats a small negative decimal", () => {
    expect(formatNumber(-0.5)).toBe("-0.50");
  });

  it("throws TypeError for Infinity", () => {
    expect(() => formatNumber(Infinity)).toThrow(TypeError);
  });

  it("throws TypeError for -Infinity", () => {
    expect(() => formatNumber(-Infinity)).toThrow(TypeError);
  });

  it("throws TypeError for NaN", () => {
    expect(() => formatNumber(NaN)).toThrow(TypeError);
  });
});

// ---------------------------------------------------------------------------
// Type guards
// ---------------------------------------------------------------------------

describe("isEmptyResult", () => {
  it("returns true for an empty-status result", () => {
    expect(isEmptyResult({ status: "empty" })).toBe(true);
  });

  it("returns false for a non-empty result", () => {
    expect(isEmptyResult({ status: "pending" })).toBe(false);
    expect(isEmptyResult({ status: "valid", value: 0 })).toBe(false);
    expect(isEmptyResult({ status: "invalid", reason: "format" })).toBe(false);
  });
});

describe("isPendingResult", () => {
  it("returns true for a pending-status result (user still typing)", () => {
    expect(isPendingResult({ status: "pending" })).toBe(true);
  });

  it("returns false for a non-pending result", () => {
    expect(isPendingResult({ status: "empty" })).toBe(false);
    expect(isPendingResult({ status: "valid", value: 42 })).toBe(false);
    expect(isPendingResult({ status: "invalid", reason: "range" })).toBe(false);
  });
});

describe("isValidResult", () => {
  it("returns true for a valid-status result and narrows type to include value", () => {
    const result = parseTemperature("100");
    expect(isValidResult(result)).toBe(true);
    if (isValidResult(result)) {
      // TypeScript would error here if narrowing didn't work — value must be accessible
      expect(result.value).toBe(100);
    }
  });

  it("returns false for a non-valid result", () => {
    expect(isValidResult({ status: "empty" })).toBe(false);
    expect(isValidResult({ status: "pending" })).toBe(false);
    expect(isValidResult({ status: "invalid", reason: "format" })).toBe(false);
  });
});

describe("isInvalidResult", () => {
  it("returns true for an invalid-status result and narrows type to include reason", () => {
    const result = parseTemperature("abc");
    expect(isInvalidResult(result)).toBe(true);
    if (isInvalidResult(result)) {
      // TypeScript would error here if narrowing didn't work — reason must be accessible
      expect(result.reason).toBe("format");
    }
  });

  it("differentiates between format and range reasons", () => {
    const formatResult = parseTemperature("abc");
    const rangeResult = parseTemperature("1500000");
    expect(isInvalidResult(formatResult) && formatResult.reason).toBe("format");
    expect(isInvalidResult(rangeResult) && rangeResult.reason).toBe("range");
  });

  it("returns false for a non-invalid result", () => {
    expect(isInvalidResult({ status: "empty" })).toBe(false);
    expect(isInvalidResult({ status: "pending" })).toBe(false);
    expect(isInvalidResult({ status: "valid", value: 0 })).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Exported constants (module stability)
// ---------------------------------------------------------------------------

describe("exported constants", () => {
  it("MAX_ABS matches the range boundary used by the parser", () => {
    // 1 000 000 is valid; 1 000 001 is range-invalid.
    expect(MAX_ABS).toBe(1_000_000);
    expect(parseTemperature(String(MAX_ABS))).toEqual({ status: "valid", value: MAX_ABS });
    expect(parseTemperature(String(MAX_ABS + 1))).toEqual({ status: "invalid", reason: "range" });
  });

  it("MAX_LENGTH matches the length boundary used by the parser", () => {
    // A string of MAX_LENGTH characters is valid (if numeric); MAX_LENGTH + 1 is format-invalid.
    expect(MAX_LENGTH).toBe(32);
    const borderline = "1".repeat(MAX_LENGTH);
    const tooLong = "1".repeat(MAX_LENGTH + 1);
    // borderline is 32 ones → numeric and well within range
    expect(parseTemperature(borderline).status).toBe("invalid"); // 111...1 (32 digits) exceeds MAX_ABS → range
    expect(parseTemperature(tooLong)).toEqual({ status: "invalid", reason: "format" });
  });
});
