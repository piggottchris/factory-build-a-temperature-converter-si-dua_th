/**
 * Temperature-converter DOM widget.
 *
 * Creates and mounts an accessible temperature-converter UI into a container
 * element.  The widget uses the `parseTemperature`, `celsiusToFahrenheit`,
 * `celsiusToKelvin`, and `formatNumber` helpers from `./convert`.
 *
 * Accessibility features:
 *  - <label> bound to the input via htmlFor / id.
 *  - aria-invalid toggled on the input for INVALID states.
 *  - aria-describedby wires the input to the visible error paragraph.
 *  - #sr-result (role="status", aria-live="polite") announces valid results.
 *  - #sr-error  (role="alert",  aria-live="assertive") announces errors.
 *  - Both SR regions are updated via a 400 ms debounce so rapid keystrokes do
 *    not interrupt screen-reader users mid-word.
 *
 * Returns a cleanup function that removes the event listener and cancels any
 * pending debounce timer; call it in test afterEach / component unmount hooks.
 */

import {
  parseTemperature,
  celsiusToFahrenheit,
  celsiusToKelvin,
  formatNumber,
  MAX_LENGTH,
} from "./convert";

/** Debounce window in milliseconds (matches the spec: 400 ms). */
export const ANNOUNCE_DEBOUNCE_MS = 400;

/**
 * Mount the temperature-converter widget into `container`.
 *
 * @param container  - A DOM element that will receive the widget markup.
 * @returns A cleanup function — call it to detach listeners and cancel timers.
 */
export function mountTemperatureWidget(container: HTMLElement): () => void {
  // ------------------------------------------------------------------
  // Build markup
  // ------------------------------------------------------------------
  container.innerHTML = `
    <main aria-label="Temperature converter">
      <h1>Temperature Converter</h1>
      <form novalidate>
        <div class="field">
          <label for="temp-input">Temperature (°C)</label>
          <input
            id="temp-input"
            type="text"
            inputmode="decimal"
            autocomplete="off"
            maxlength="${MAX_LENGTH}"
            aria-describedby="temp-error"
          />
        </div>
        <p id="temp-result" role="status" aria-live="polite" aria-atomic="true"></p>
        <p id="temp-error" aria-live="assertive" aria-atomic="true"></p>
      </form>
      <div
        id="sr-result"
        role="status"
        aria-live="polite"
        aria-atomic="true"
        style="position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0"
      ></div>
      <div
        id="sr-error"
        role="alert"
        aria-live="assertive"
        aria-atomic="true"
        style="position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0"
      ></div>
    </main>
  `;

  // ------------------------------------------------------------------
  // Query DOM references (asserted non-null — elements just created above)
  // ------------------------------------------------------------------
  const input = container.querySelector<HTMLInputElement>("#temp-input")!;
  const tempResult = container.querySelector<HTMLParagraphElement>("#temp-result")!;
  const tempError = container.querySelector<HTMLParagraphElement>("#temp-error")!;
  const srResult = container.querySelector<HTMLDivElement>("#sr-result")!;
  const srError = container.querySelector<HTMLDivElement>("#sr-error")!;

  // ------------------------------------------------------------------
  // State
  // ------------------------------------------------------------------
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  // ------------------------------------------------------------------
  // Event handler
  // ------------------------------------------------------------------
  function handleInput(): void {
    const raw = input.value;
    const result = parseTemperature(raw);

    // Cancel any pending SR announcement — the user is still typing.
    if (debounceTimer !== null) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }

    // Clear SR regions immediately; they will be repopulated after the
    // debounce window expires (if the user pauses for >= 400 ms).
    srResult.textContent = "";
    srError.textContent = "";

    switch (result.status) {
      case "empty":
        input.removeAttribute("aria-invalid");
        tempResult.textContent = "";
        tempError.textContent = "";
        break;

      case "pending":
        // User is mid-entry (e.g. typed "-") — show no validation feedback.
        input.setAttribute("aria-invalid", "false");
        tempResult.textContent = "";
        tempError.textContent = "";
        break;

      case "valid": {
        input.setAttribute("aria-invalid", "false");
        const f = formatNumber(celsiusToFahrenheit(result.value));
        const k = formatNumber(celsiusToKelvin(result.value));
        tempResult.textContent = `${f} °F / ${k} K`;
        tempError.textContent = "";
        debounceTimer = setTimeout(() => {
          srResult.textContent = `${f} degrees Fahrenheit, ${k} Kelvin`;
          srError.textContent = "";
        }, ANNOUNCE_DEBOUNCE_MS);
        break;
      }

      case "invalid": {
        input.setAttribute("aria-invalid", "true");
        const msg =
          result.reason === "range"
            ? "Value must be between −1,000,000 and 1,000,000 °C"
            : "Please enter a valid number (digits and optional leading minus or decimal point)";
        tempResult.textContent = "";
        tempError.textContent = msg;
        debounceTimer = setTimeout(() => {
          srError.textContent = msg;
          srResult.textContent = "";
        }, ANNOUNCE_DEBOUNCE_MS);
        break;
      }
    }
  }

  input.addEventListener("input", handleInput);

  // ------------------------------------------------------------------
  // Cleanup
  // ------------------------------------------------------------------
  return function unmount(): void {
    input.removeEventListener("input", handleInput);
    if (debounceTimer !== null) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }
  };
}
