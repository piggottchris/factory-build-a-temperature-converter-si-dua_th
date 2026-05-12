/**
 * Temperature-converter utility: parser, math helpers, and formatter.
 *
 * Parser classifies a raw string into one of four states:
 *   - empty   : blank or whitespace-only input — field is untouched, show no
 *               validation message.
 *   - pending : syntactically incomplete but plausible — the user is mid-entry
 *               (e.g. they have typed "-" and are about to add digits). UI
 *               should remain neutral: show neither a green valid indicator nor
 *               a red error. Triggering an error on these states would cause
 *               distracting flash-of-invalid as the user types.
 *   - valid   : a complete, in-range number — safe to pass to math helpers and
 *               the formatter.
 *   - invalid : bad format or out-of-range value — show an error message.
 *
 * Use the exported type guards (`isValidResult`, `isPendingResult`, etc.) for
 * concise, type-safe narrowing in component code.
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
// Type guards
// ---------------------------------------------------------------------------

/**
 * Narrows a `ParseResult` to the `empty` variant.
 * Use this to decide whether to hide all validation UI entirely.
 */
export function isEmptyResult(r: ParseResult): r is { status: "empty" } {
  return r.status === "empty";
}

/**
 * Narrows a `ParseResult` to the `pending` variant.
 * Use this to keep the input field in a neutral (non-error, non-success) state
 * while the user is still typing an incomplete number such as "-" or "1.".
 */
export function isPendingResult(r: ParseResult): r is { status: "pending" } {
  return r.status === "pending";
}

/**
 * Narrows a `ParseResult` to the `valid` variant, giving typed access to
 * `result.value`.  Only `valid` results carry a numeric value safe for
 * conversion and formatting.
 */
export function isValidResult(
  r: ParseResult
): r is { status: "valid"; value: number } {
  return r.status === "valid";
}

/**
 * Narrows a `ParseResult` to the `invalid` variant, giving typed access to
 * `result.reason` ("format" | "range").  Use `reason` to choose the right
 * user-facing error message.
 */
export function isInvalidResult(
  r: ParseResult
): r is { status: "invalid"; reason: "format" | "range" } {
  return r.status === "invalid";
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Maximum absolute value (inclusive) accepted by the parser.
 * Re-exported so callers that build their own input-validation UI can import
 * the same boundary constant rather than hard-coding a magic number.
 */
export const MAX_ABS = 1_000_000;

/**
 * Maximum character count (after trimming) before we reject as invalid format.
 * A 33-character string is explicitly required to be "invalid: format".
 * Re-exported for callers who want to apply the same length cap in their own
 * validation pass (e.g. to set a maxLength attribute on an <input>).
 */
export const MAX_LENGTH = 32;

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

/**
 * Convert Celsius to Kelvin: K = C + 273.15.
 *
 * The raw addition `celsius + 273.15` is subject to IEEE 754 drift for many
 * inputs (e.g. `celsiusToKelvin(-40)` → `233.14999999999998` without this
 * fix).  Rounding to 10 decimal places eliminates all sub-picogram drift while
 * preserving every digit that is physically meaningful — temperature
 * measurements are accurate to at most ~0.001 K in any practical application,
 * far coarser than the 10-decimal precision retained here.
 */
export function celsiusToKelvin(celsius: number): number {
  return Math.round((celsius + 273.15) * 1e10) / 1e10;
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
 *
 * Throws a TypeError for non-finite inputs (NaN, Infinity, -Infinity) so
 * callers receive an explicit error rather than a misleading string like
 * "Infinity" or "NaN". The parser never produces non-finite values in a
 * `valid` result, but `formatNumber` is a public export and must be
 * defensively hardened.
 */
export function formatNumber(n: number): string {
  if (!isFinite(n)) {
    throw new TypeError(
      `formatNumber requires a finite number; received ${n}`
    );
  }
  // Object.is distinguishes -0 from +0
  const normalised = Object.is(n, -0) ? 0 : n;
  return normalised.toFixed(2);
}
