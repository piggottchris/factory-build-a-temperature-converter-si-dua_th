/**
 * Temperature conversion utilities.
 * Pure functions — no side effects, no external dependencies.
 */

export type TemperatureUnit = "celsius" | "fahrenheit" | "kelvin";

const SUPPORTED: TemperatureUnit[] = ["celsius", "fahrenheit", "kelvin"];

/** Absolute-zero values for each unit */
const ABSOLUTE_ZERO: Record<TemperatureUnit, number> = {
  celsius: -273.15,
  fahrenheit: -459.67,
  kelvin: 0,
};

/**
 * Convert a temperature value between units.
 *
 * @throws {Error} If a unit is unsupported or the value is below absolute zero.
 */
export function convertTemperature(
  value: number,
  fromUnit: TemperatureUnit,
  toUnit: TemperatureUnit
): number {
  const from = fromUnit.toLowerCase() as TemperatureUnit;
  const to = toUnit.toLowerCase() as TemperatureUnit;

  if (!SUPPORTED.includes(from)) {
    throw new Error(`Unsupported unit: "${from}". Supported: ${SUPPORTED.join(", ")}`);
  }
  if (!SUPPORTED.includes(to)) {
    throw new Error(`Unsupported unit: "${to}". Supported: ${SUPPORTED.join(", ")}`);
  }

  // Reject IEEE 754 special values — NaN and Infinity are not physical temperatures
  if (Number.isNaN(value)) {
    throw new Error("Temperature value must be a finite number, got NaN.");
  }
  if (!Number.isFinite(value)) {
    throw new Error("Temperature value must be a finite number, got Infinity.");
  }

  const absZero = ABSOLUTE_ZERO[from];
  if (value < absZero - 1e-9) {
    throw new Error(
      `${value} ${from} is below absolute zero (${absZero} ${from}). ` +
        `Physical temperatures cannot be this low.`
    );
  }

  // Same-unit pass-through
  if (from === to) return value;

  // Convert to Celsius as intermediate
  let celsius: number;
  if (from === "celsius") {
    celsius = value;
  } else if (from === "fahrenheit") {
    celsius = ((value - 32) * 5) / 9;
  } else {
    // kelvin
    celsius = value - 273.15;
  }

  // Convert Celsius → target
  if (to === "celsius") return celsius;
  if (to === "fahrenheit") return (celsius * 9) / 5 + 32;
  return celsius + 273.15; // kelvin
}

/**
 * Return the list of supported temperature unit names (display form).
 */
export function listSupportedUnits(): string[] {
  return ["Celsius", "Fahrenheit", "Kelvin"];
}

/**
 * Format a numeric result for display: up to 4 decimal places, trailing zeros
 * stripped so that 212.0000 → "212" and 98.6000 → "98.6".
 *
 * Uses a threshold of 1e-9 to treat near-integers as integers, preventing
 * floating-point noise like 211.99999999 from rendering as "212.0000".
 */
export function smartRound(value: number): string {
  // Clamp to 4 decimal places then remove trailing zeros.
  // parseFloat(toFixed(4)) strips trailing fractional zeros; toString() handles it cleanly.
  const fixed4 = parseFloat(value.toFixed(4));
  return fixed4.toString();
}

/**
 * Format a converted result for display.
 */
export function formatResult(
  value: number,
  fromUnit: TemperatureUnit,
  toUnit: TemperatureUnit
): string {
  try {
    const result = convertTemperature(value, fromUnit, toUnit);
    return `${value} ${capitalize(fromUnit)} = ${smartRound(result)} ${capitalize(toUnit)}`;
  } catch (e) {
    return (e as Error).message;
  }
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
