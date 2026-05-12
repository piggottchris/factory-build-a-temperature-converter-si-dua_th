/**
 * Tests for temperature conversion utility.
 * Phase: RED — written before implementation.
 */

import { describe, expect, it } from "vitest";
import {
  convertTemperature,
  listSupportedUnits,
  smartRound,
  type TemperatureUnit,
} from "../app/lib/temperature";

describe("convertTemperature", () => {
  // Celsius → Fahrenheit
  it("converts 100°C to 212°F", () => {
    expect(convertTemperature(100, "celsius", "fahrenheit")).toBeCloseTo(212, 5);
  });

  it("converts 0°C to 32°F", () => {
    expect(convertTemperature(0, "celsius", "fahrenheit")).toBeCloseTo(32, 5);
  });

  it("converts -40°C to -40°F", () => {
    expect(convertTemperature(-40, "celsius", "fahrenheit")).toBeCloseTo(-40, 5);
  });

  // Fahrenheit → Celsius
  it("converts 212°F to 100°C", () => {
    expect(convertTemperature(212, "fahrenheit", "celsius")).toBeCloseTo(100, 5);
  });

  it("converts 32°F to 0°C", () => {
    expect(convertTemperature(32, "fahrenheit", "celsius")).toBeCloseTo(0, 5);
  });

  // Celsius → Kelvin
  it("converts 0°C to 273.15K", () => {
    expect(convertTemperature(0, "celsius", "kelvin")).toBeCloseTo(273.15, 5);
  });

  it("converts 100°C to 373.15K", () => {
    expect(convertTemperature(100, "celsius", "kelvin")).toBeCloseTo(373.15, 5);
  });

  // Kelvin → Celsius
  it("converts 0K to -273.15°C", () => {
    expect(convertTemperature(0, "kelvin", "celsius")).toBeCloseTo(-273.15, 5);
  });

  // Fahrenheit → Kelvin
  it("converts 212°F to 373.15K", () => {
    expect(convertTemperature(212, "fahrenheit", "kelvin")).toBeCloseTo(373.15, 5);
  });

  // Kelvin → Fahrenheit
  it("converts 373.15K to 212°F", () => {
    expect(convertTemperature(373.15, "kelvin", "fahrenheit")).toBeCloseTo(212, 4);
  });

  // Same-unit pass-through
  it("passes through celsius unchanged", () => {
    expect(convertTemperature(25, "celsius", "celsius")).toBeCloseTo(25, 5);
  });

  it("passes through fahrenheit unchanged", () => {
    expect(convertTemperature(98.6, "fahrenheit", "fahrenheit")).toBeCloseTo(98.6, 5);
  });

  it("passes through kelvin unchanged", () => {
    expect(convertTemperature(300, "kelvin", "kelvin")).toBeCloseTo(300, 5);
  });

  // Absolute zero guard
  it("throws on negative kelvin input", () => {
    expect(() => convertTemperature(-1, "kelvin", "celsius")).toThrow(
      /below absolute zero/i
    );
  });

  it("throws on celsius below -273.15", () => {
    expect(() => convertTemperature(-274, "celsius", "kelvin")).toThrow(
      /below absolute zero/i
    );
  });

  // Invalid units
  it("throws on unsupported from-unit", () => {
    expect(() =>
      convertTemperature(100, "rankine" as TemperatureUnit, "celsius")
    ).toThrow(/unsupported unit/i);
  });

  it("throws on unsupported to-unit", () => {
    expect(() =>
      convertTemperature(100, "celsius", "rankine" as TemperatureUnit)
    ).toThrow(/unsupported unit/i);
  });

  // NaN / Infinity guard
  it("throws on NaN input", () => {
    expect(() => convertTemperature(NaN, "celsius", "fahrenheit")).toThrow(
      /finite number.*NaN/i
    );
  });

  it("throws on Infinity input", () => {
    expect(() => convertTemperature(Infinity, "celsius", "kelvin")).toThrow(
      /finite number.*Infinity/i
    );
  });

  it("throws on negative Infinity input", () => {
    expect(() => convertTemperature(-Infinity, "kelvin", "celsius")).toThrow(
      /finite number.*Infinity/i
    );
  });
});

describe("smartRound", () => {
  it("formats a whole number without decimals", () => {
    expect(smartRound(212)).toBe("212");
  });

  it("strips trailing zeros from .toFixed(4) output", () => {
    // 212°F from 100°C is exactly 212.0
    expect(smartRound(212.0)).toBe("212");
  });

  it("preserves meaningful decimal places", () => {
    // 37°C to F = 98.6 exactly
    expect(smartRound(98.6)).toBe("98.6");
  });

  it("rounds to 4 decimal places max", () => {
    // 1/3 ≈ 0.3333333…
    expect(smartRound(1 / 3)).toBe("0.3333");
  });

  it("strips trailing zeros from a value with fewer than 4 significant decimals", () => {
    // 0.5 → "0.5" not "0.5000"
    expect(smartRound(0.5)).toBe("0.5");
  });

  it("handles negative values", () => {
    expect(smartRound(-40)).toBe("-40");
  });

  it("handles zero", () => {
    expect(smartRound(0)).toBe("0");
  });
});

describe("listSupportedUnits", () => {
  it("returns at least 3 units", () => {
    expect(listSupportedUnits().length).toBeGreaterThanOrEqual(3);
  });

  it("includes celsius", () => {
    const units = listSupportedUnits().map((u) => u.toLowerCase());
    expect(units).toContain("celsius");
  });

  it("includes fahrenheit", () => {
    const units = listSupportedUnits().map((u) => u.toLowerCase());
    expect(units).toContain("fahrenheit");
  });

  it("includes kelvin", () => {
    const units = listSupportedUnits().map((u) => u.toLowerCase());
    expect(units).toContain("kelvin");
  });
});
