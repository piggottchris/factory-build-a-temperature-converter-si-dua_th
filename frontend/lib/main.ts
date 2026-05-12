/**
 * Temperature-converter DOM controller.
 *
 * Call `init()` once the relevant elements are present in `document`.
 * Each call creates an independent closure (fresh lastValidF / lastValidK
 * state), so the function is safe to call multiple times — e.g. in tests
 * that reset `document.body.innerHTML` between cases.
 *
 * Element IDs expected in the DOM:
 *   #celsius-input      — text <input> for the Celsius value
 *   #sign-toggle        — <button> that negates the current value
 *   #empty-hint         — shown only in EMPTY state
 *   #helper-text        — always visible; static instructional copy
 *   #error-slot         — shown only in INVALID state
 *   #fahrenheit-output  — Fahrenheit result or "—"
 *   #kelvin-output      — Kelvin result or "—"
 *   #context-line       — shown in INVALID state when a prior valid value exists
 */

import {
  parseTemperature,
  celsiusToFahrenheit,
  celsiusToKelvin,
  formatNumber,
  isEmptyResult,
  isPendingResult,
  isValidResult,
  isInvalidResult,
  MAX_LENGTH,
} from "./convert";

// ---------------------------------------------------------------------------
// User-facing copy strings — exported so dom.test.ts can import them and
// verify exact text without duplicating the strings in the test file.
// ---------------------------------------------------------------------------

/** Shown in #error-slot when parseTemperature returns reason === "format". */
export const FORMAT_ERROR_MSG =
  "Invalid format — only decimal numbers are accepted (e.g. -23.5).";

/** Shown in #error-slot when parseTemperature returns reason === "range". */
export const RANGE_ERROR_MSG =
  "Out of range — enter a value between -1 000 000 and 1 000 000.";

// ---------------------------------------------------------------------------
// Controller
// ---------------------------------------------------------------------------

/**
 * Wire up all event listeners for the converter UI.
 *
 * State machine (per input event):
 *
 *   EMPTY   → outputs "—", error hidden, hint visible, context hidden.
 *             Resets lastValidF/K so context cannot appear on the next error.
 *
 *   PENDING → outputs unchanged (don't flash "—" mid-typing), error hidden.
 *             hint hidden (user has started typing).
 *
 *   VALID   → compute & display F/K, update lastValidF/K, clear error + context.
 *
 *   INVALID → outputs "—", error visible with correct message.
 *             If lastValidF is set, show context line "was: … · …".
 */
export function init(): void {
  const input = document.getElementById("celsius-input") as HTMLInputElement;
  const signToggle = document.getElementById(
    "sign-toggle"
  ) as HTMLButtonElement;
  const emptyHint = document.getElementById("empty-hint") as HTMLElement;
  const errorSlot = document.getElementById("error-slot") as HTMLElement;
  const fahrenheitOutput = document.getElementById(
    "fahrenheit-output"
  ) as HTMLElement;
  const kelvinOutput = document.getElementById("kelvin-output") as HTMLElement;
  const contextLine = document.getElementById("context-line") as HTMLElement;

  // Enforce the parser's length cap at the browser level so arbitrarily long
  // pastes are truncated before they ever reach parseTemperature().
  // MAX_LENGTH is the same constant used by the parser, keeping the two in sync.
  input.maxLength = MAX_LENGTH;

  // Per-instance state — lives in the closure, never leaks between init() calls.
  let lastValidF = "";
  let lastValidK = "";

  function render(): void {
    const result = parseTemperature(input.value);

    if (isEmptyResult(result)) {
      fahrenheitOutput.textContent = "—";
      kelvinOutput.textContent = "—";
      errorSlot.hidden = true;
      errorSlot.textContent = "";
      emptyHint.hidden = false;
      contextLine.hidden = true;
      contextLine.textContent = "";
      lastValidF = "";
      lastValidK = "";
      return;
    }

    // Once the user starts typing, hide the empty-state hint.
    emptyHint.hidden = true;

    if (isPendingResult(result)) {
      // Neutral: don't update outputs or show an error.
      errorSlot.hidden = true;
      return;
    }

    if (isValidResult(result)) {
      const f = celsiusToFahrenheit(result.value);
      const k = celsiusToKelvin(result.value);
      const fStr = `${formatNumber(f)} °F`;
      const kStr = `${formatNumber(k)} K`;

      fahrenheitOutput.textContent = fStr;
      kelvinOutput.textContent = kStr;
      lastValidF = fStr;
      lastValidK = kStr;

      errorSlot.hidden = true;
      errorSlot.textContent = "";
      contextLine.hidden = true;
      contextLine.textContent = "";
      return;
    }

    if (isInvalidResult(result)) {
      fahrenheitOutput.textContent = "—";
      kelvinOutput.textContent = "—";

      errorSlot.hidden = false;
      errorSlot.textContent =
        result.reason === "format" ? FORMAT_ERROR_MSG : RANGE_ERROR_MSG;

      if (lastValidF) {
        contextLine.hidden = false;
        contextLine.textContent = `was: ${lastValidF} · ${lastValidK}`;
      } else {
        contextLine.hidden = true;
      }
    }
  }

  input.addEventListener("input", render);

  signToggle.addEventListener("click", () => {
    if (input.value === "") return; // no-op for empty input
    input.value = input.value.startsWith("-")
      ? input.value.slice(1)
      : `-${input.value}`;
    render();
  });

  // Set initial state immediately.
  render();
}
