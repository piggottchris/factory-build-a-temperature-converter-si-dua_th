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
 * Format a converted result for display.
 */
export function formatResult(
  value: number,
  fromUnit: TemperatureUnit,
  toUnit: TemperatureUnit
): string {
  try {
    const result = convertTemperature(value, fromUnit, toUnit);
    return `${value} ${capitalize(fromUnit)} = ${result.toFixed(2)} ${capitalize(toUnit)}`;
  } catch (e) {
    return (e as Error).message;
  }
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
