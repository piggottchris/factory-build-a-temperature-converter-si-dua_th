/**
 * Temperature-converter utility: parser, math helpers, and formatter.
 *
 * Parser classifies a raw string into one of four states:
 *   - empty   : blank or whitespace-only input
 *   - pending : incomplete but syntactically plausible (user still typing)
 *   - valid   : a complete, in-range number
 *   - invalid : bad format or out-of-range value
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ParseResult =
  | { status: "empty" }
  | { status: "pending" }
  | { status: "valid"; value: number }
  | { status: "invalid"; reason: "format" | "range" };

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Maximum absolute value accepted by the parser. */
const MAX_ABS = 1_000_000;

/**
 * Maximum character count (after trimming) before we reject as invalid format.
 * A 33-character string is explicitly required to be "invalid: format".
 */
const MAX_LENGTH = 32;

/**
 * Allowlist regex for a fully-typed number:
 *   optional leading minus, then either
 *     digits (integer), or
 *     digits.digits (decimal), or
 *     .digits (leading-dot decimal)
 *
 * Scientific notation, commas, double minus, letters, etc. are all excluded.
 */
const COMPLETE_NUMBER_RE = /^-?(\d+\.\d+|\.\d+|\d+)$/;

/**
 * Patterns that represent an *incomplete* number a user may still be typing.
 * A Set gives O(1) membership tests and is cleaner than an array includes().
 */
const PENDING_EXACT = new Set(["-", ".", "-.", "-0"]);

/**
 * Matches a number that ends with a trailing decimal point, e.g. "1." or "-1.".
 * The user is mid-entry and will add fractional digits next.
 */
const TRAILING_DOT_RE = /^-?\d+\.$/;

// ---------------------------------------------------------------------------
// Parser
// ---------------------------------------------------------------------------

/**
 * Parse a raw temperature string into a discriminated-union result.
 *
 * The function trims surrounding whitespace before any other check.
 */
export function parseTemperature(raw: string): ParseResult {
  const s = raw.trim();

  // 1. Empty
  if (s === "") return { status: "empty" };

  // 2. Length guard (checked before pending so a 33-char minus-chain is format-invalid)
  if (s.length > MAX_LENGTH) return { status: "invalid", reason: "format" };

  // 3. Pending — user is still typing
  if (PENDING_EXACT.has(s) || TRAILING_DOT_RE.test(s)) {
    return { status: "pending" };
  }

  // 4. Format validation
  if (!COMPLETE_NUMBER_RE.test(s)) {
    return { status: "invalid", reason: "format" };
  }

  // 5. Numeric conversion and range check
  const value = Number(s);

  if (Math.abs(value) > MAX_ABS) {
    return { status: "invalid", reason: "range" };
  }

  return { status: "valid", value };
}

// ---------------------------------------------------------------------------
// Math helpers
// ---------------------------------------------------------------------------

/** Convert Celsius to Fahrenheit: F = C × 9/5 + 32. */
export function celsiusToFahrenheit(celsius: number): number {
  return (celsius * 9) / 5 + 32;
}

/** Convert Celsius to Kelvin: K = C + 273.15. */
export function celsiusToKelvin(celsius: number): number {
  return celsius + 273.15;
}

// ---------------------------------------------------------------------------
// Formatter
// ---------------------------------------------------------------------------

/**
 * Format a number to exactly two decimal places.
 *
 * Handles negative zero explicitly so that `-0` displays as `"0.00"` rather
 * than `"-0.00"`. All other values use the standard half-away-from-zero
 * rounding implemented by `Number.prototype.toFixed`.
 */
export function formatNumber(n: number): string {
  // Object.is distinguishes -0 from +0
  const normalised = Object.is(n, -0) ? 0 : n;
  return normalised.toFixed(2);
}
