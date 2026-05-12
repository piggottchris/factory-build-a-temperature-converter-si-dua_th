"use client";

import { useState } from "react";
import { CopilotKit } from "@copilotkit/react-core";
import { CopilotChat } from "@copilotkit/react-ui";
import "@copilotkit/react-ui/styles.css";
import {
  convertTemperature,
  listSupportedUnits,
  smartRound,
  type TemperatureUnit,
} from "./lib/temperature";

const UNITS = listSupportedUnits();
const UNIT_KEYS = UNITS.map((u) => u.toLowerCase()) as TemperatureUnit[];

function QuickConverter() {
  const [value, setValue] = useState<string>("");
  const [fromUnit, setFromUnit] = useState<TemperatureUnit>("celsius");
  const [toUnit, setToUnit] = useState<TemperatureUnit>("fahrenheit");
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleConvert() {
    const num = parseFloat(value);
    if (isNaN(num)) {
      setError("Please enter a valid number.");
      setResult(null);
      return;
    }
    try {
      const converted = convertTemperature(num, fromUnit, toUnit);
      setResult(smartRound(converted));
      setError(null);
    } catch (e) {
      setError((e as Error).message);
      setResult(null);
    }
  }

  return (
    <section
      aria-label="Quick temperature converter"
      className="rounded-lg border bg-white p-6 shadow-sm"
    >
      <h2 className="mb-4 text-lg font-semibold text-gray-700">Quick Convert</h2>
      <div className="flex flex-wrap gap-3 items-end">
        <div className="flex flex-col gap-1">
          <label htmlFor="temp-value" className="text-sm text-gray-600">
            Value
          </label>
          <input
            id="temp-value"
            type="number"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleConvert()}
            placeholder="e.g. 100"
            className="w-32 rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            aria-label="Temperature value"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="from-unit" className="text-sm text-gray-600">
            From
          </label>
          <select
            id="from-unit"
            value={fromUnit}
            onChange={(e) => setFromUnit(e.target.value as TemperatureUnit)}
            className="rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            aria-label="From unit"
          >
            {UNITS.map((u, i) => (
              <option key={u} value={UNIT_KEYS[i]}>
                {u}
              </option>
            ))}
          </select>
        </div>
        <span className="pb-2 text-gray-400" aria-hidden="true">→</span>
        <div className="flex flex-col gap-1">
          <label htmlFor="to-unit" className="text-sm text-gray-600">
            To
          </label>
          <select
            id="to-unit"
            value={toUnit}
            onChange={(e) => setToUnit(e.target.value as TemperatureUnit)}
            className="rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            aria-label="To unit"
          >
            {UNITS.map((u, i) => (
              <option key={u} value={UNIT_KEYS[i]}>
                {u}
              </option>
            ))}
          </select>
        </div>
        <button
          onClick={handleConvert}
          className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-1 transition-colors"
          aria-label="Convert temperature"
        >
          Convert
        </button>
      </div>

      {/* Result */}
      {result !== null && (
        <div
          role="status"
          aria-live="polite"
          className="mt-4 rounded bg-green-50 border border-green-200 px-4 py-3 text-green-800 text-sm"
        >
          <span className="font-semibold">Result:</span>{" "}
          {value} {fromUnit.charAt(0).toUpperCase() + fromUnit.slice(1)} ={" "}
          <span className="font-bold">{result}</span>{" "}
          {toUnit.charAt(0).toUpperCase() + toUnit.slice(1)}
        </div>
      )}

      {/* Error */}
      {error && (
        <div
          role="alert"
          className="mt-4 rounded bg-red-50 border border-red-200 px-4 py-3 text-red-700 text-sm"
        >
          {error}
        </div>
      )}
    </section>
  );
}

export default function Home() {
  return (
    <CopilotKit runtimeUrl="/api/copilotkit" agent="temperature_agent">
      <main className="flex h-screen w-screen flex-col bg-gray-50">
        <header className="border-b bg-white px-6 py-4 shadow-sm">
          <h1 className="text-xl font-semibold text-gray-900">
            🌡️ Temperature Converter
          </h1>
          <p className="text-sm text-gray-500">
            Convert between Celsius, Fahrenheit, and Kelvin — instantly or via AI assistant.
          </p>
        </header>

        <div className="flex flex-1 overflow-hidden">
          {/* Left pane — quick converter */}
          <aside className="flex w-full flex-col gap-6 overflow-y-auto p-6 md:w-1/2 lg:w-2/5">
            <QuickConverter />

            <section className="rounded-lg border bg-white p-4 text-sm text-gray-600 shadow-sm">
              <h2 className="mb-2 font-semibold text-gray-700">Reference Points</h2>
              <ul className="space-y-1">
                <li>🧊 Water freezes at 0 °C / 32 °F / 273.15 K</li>
                <li>♨️ Water boils at 100 °C / 212 °F / 373.15 K</li>
                <li>🌡️ Body temperature ≈ 37 °C / 98.6 °F / 310.15 K</li>
                <li>❄️ Absolute zero: −273.15 °C / −459.67 °F / 0 K</li>
              </ul>
            </section>
          </aside>

          {/* Right pane — AI chat */}
          <div className="hidden flex-1 border-l bg-white md:flex md:flex-col">
            <div className="border-b px-4 py-3">
              <p className="text-sm font-medium text-gray-700">AI Assistant</p>
              <p className="text-xs text-gray-400">
                Ask me anything — "Convert 98.6°F to Celsius" or "What's 300K in Fahrenheit?"
              </p>
            </div>
            <div className="flex-1 overflow-y-auto">
              <CopilotChat
                className="h-full w-full"
                instructions="You are a temperature converter assistant. Help users convert temperatures between Celsius, Fahrenheit, and Kelvin. Always use the convert_temperature_tool for conversions."
              />
            </div>
          </div>
        </div>
      </main>
    </CopilotKit>
  );
}
