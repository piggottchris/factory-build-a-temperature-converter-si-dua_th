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

// ─── Parser ───────────────────────────────────────────────────────────────────

/**
 * Parse a raw string from the Celsius input field.
 *
 * - Empty / whitespace-only → "empty"
 * - Partial numeric entry (e.g. "-", "1.", "-.") → "pending"
 * - Non-numeric → "invalid" (format)
 * - Out of [-1 000 000, 1 000 000] → "invalid" (range)
 * - Otherwise → "valid" with the numeric value
 */
export function parseCelsius(raw: string): ParseResult {
  const trimmed = raw.trim();

  if (trimmed === "") {
    return { type: "empty" };
  }

  // Partial entries the user might still complete
  if (trimmed === "-" || trimmed === "." || trimmed === "-." || trimmed.endsWith(".")) {
    return { type: "pending" };
  }

  const n = Number(trimmed);
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
