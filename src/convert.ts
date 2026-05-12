/** Minimum allowed Celsius value. */
export const CELSIUS_MIN = -1_000_000;

/** Maximum allowed Celsius value. */
export const CELSIUS_MAX = 1_000_000;

// ─── Result types ─────────────────────────────────────────────────────────────

export type ParseResult =
  | { type: "empty" }
  | { type: "pending" }
  | { type: "valid"; value: number }
  | { type: "invalid"; reason: "format" | "range" };

// ─── Parser internals ─────────────────────────────────────────────────────────

/**
 * Decimal-only regex.  Accepts optional leading sign, integer or decimal digits,
 * and an optional exponent.  Explicitly rejects hex (0x…), binary (0b…), octal
 * (0o…), underscores, and comma-separated thousands — all of which JavaScript's
 * `Number()` would silently accept as valid numbers, making them appear to be
 * valid Celsius values when they should be format errors.
 *
 * Valid examples: 100, -40, 36.6, +0.5, -.5, 1e6, 1E+5, 1.5e-3
 */
const DECIMAL_NUMBER_RE = /^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/;

/**
 * Partial (in-progress) entry patterns.
 *
 * These match strings the user is still composing but which cannot yet be
 * evaluated as a number.  Classifying them as "pending" instead of "invalid"
 * prevents spurious error messages mid-keystroke.
 *
 *  1. Lone sign or sign+dot:          "-", "+", ".", "-.", "+."
 *  2. Trailing-E (no exponent digits): "1e", "36.6E", "-1.5e"
 *  3. E with sign but no digits:       "1e+", "1e-", "36.6E-"
 */
const PENDING_RES: RegExp[] = [
  /^[+-]?\.?$/,                                    // -, +, ., -., +.
  /^[+-]?(\d+\.?\d*|\.\d+)[eE]$/,                 // 1e, 36.6E
  /^[+-]?(\d+\.?\d*|\.\d+)[eE][+-]$/,             // 1e+, 1e-, 36.6E-
];

// ─── Parser ───────────────────────────────────────────────────────────────────

/**
 * Parse a raw string from the Celsius input field.
 *
 * - Empty / whitespace-only → "empty"
 * - Partial numeric entry (e.g. "-", "1.", "-.", "1e", "1e+") → "pending"
 * - Non-decimal or non-numeric → "invalid" (format)
 *   Note: hex (0x…), binary (0b…) and underscore-separated (1_000) strings
 *   are treated as format errors even though Number() would accept them.
 * - Out of [-1 000 000, 1 000 000] → "invalid" (range)
 * - Otherwise → "valid" with the numeric value
 */
export function parseCelsius(raw: string): ParseResult {
  // Normalise Unicode minus sign (U+2212 "−") to ASCII hyphen so users who
  // copy/paste a value from a rich-text source still get a usable result.
  const trimmed = raw.trim().replace(/−/g, "-");

  if (trimmed === "") {
    return { type: "empty" };
  }

  // Partial entries the user might still be composing
  if (PENDING_RES.some((re) => re.test(trimmed))) {
    return { type: "pending" };
  }

  // Reject anything that isn't plain decimal notation
  if (!DECIMAL_NUMBER_RE.test(trimmed)) {
    return { type: "invalid", reason: "format" };
  }

  const n = Number(trimmed);
  // Belt-and-suspenders: DECIMAL_NUMBER_RE already excludes Infinity/NaN paths,
  // but guard explicitly so future regex changes can't silently regress this.
  if (!isFinite(n) || isNaN(n)) {
    return { type: "invalid", reason: "format" };
  }

  if (n < CELSIUS_MIN || n > CELSIUS_MAX) {
    return { type: "invalid", reason: "range" };
  }

  return { type: "valid", value: n };
}

// ─── Conversion math ──────────────────────────────────────────────────────────

/** Convert Celsius to Fahrenheit. */
export function celsiusToFahrenheit(c: number): number {
  return c * 1.8 + 32;
}

/** Convert Celsius to Kelvin. */
export function celsiusToKelvin(c: number): number {
  return c + 273.15;
}

// ─── Formatter ────────────────────────────────────────────────────────────────

/**
 * Format a number to exactly two decimal places.
 * Uses `toFixed` so 212 → "212.00", 373.15 → "373.15".
 */
export function formatNumber(n: number): string {
  return n.toFixed(2);
}
