/**
 * src/main.ts — Temperature converter DOM controller
 *
 * Manages the EMPTY / PENDING / VALID / INVALID state machine, wiring the
 * #celsius-input to the conversion functions in convert.ts.
 *
 * All dynamic DOM writes use `textContent` exclusively — never `innerHTML` —
 * so user-supplied strings are never interpreted as markup (XSS safe).
 */

import {
  parseCelsius,
  celsiusToFahrenheit,
  celsiusToKelvin,
  formatNumber,
} from "./convert.ts";

// ── Error strings (exact, per spec) ──────────────────────────────────────────

const MSG_FORMAT =
  'Please enter a valid number (use "." as the decimal point, e.g. 36.6 or -40).';
const MSG_RANGE = "Enter a value between -1,000,000 and 1,000,000 °C.";

// ── Last-valid context ────────────────────────────────────────────────────────

interface LastValid {
  fahrenheit: string;
  kelvin: string;
}

// ── Core controller ───────────────────────────────────────────────────────────

/**
 * Wire the input event listener onto `document`.
 * Exported so tests can pass a jsdom Document instance directly.
 */
export function initConverter(document: Document): void {
  const input = document.getElementById("celsius-input") as HTMLInputElement | null;
  const emptyHint = document.getElementById("empty-hint") as HTMLElement | null;
  const errorMsg = document.getElementById("error-message") as HTMLElement | null;
  const fahrenheitOutput = document.getElementById("fahrenheit-output") as HTMLOutputElement | null;
  const kelvinOutput = document.getElementById("kelvin-output") as HTMLOutputElement | null;

  // Guard: bail silently when the expected DOM isn't present (e.g. wrong page).
  if (!input || !emptyHint || !errorMsg || !fahrenheitOutput || !kelvinOutput) {
    return;
  }

  let lastValid: LastValid | null = null;

  // ── Helpers ────────────────────────────────────────────────────────────────

  /** Set both output elements using textContent. */
  function setOutputs(f: string, k: string): void {
    fahrenheitOutput!.textContent = f;
    kelvinOutput!.textContent = k;
  }

  /**
   * Deterministically rebuild aria-describedby so it contains exactly the
   * IDs appropriate for each state:
   *   empty   → ["empty-hint"]
   *   normal  → []          (pending / valid — no extra description needed)
   *   error   → ["error-message"]
   */
  function setAriaDescribedBy(ids: string[]): void {
    if (ids.length === 0) {
      input!.removeAttribute("aria-describedby");
    } else {
      input!.setAttribute("aria-describedby", ids.join(" "));
    }
  }

  // ── Input handler ──────────────────────────────────────────────────────────

  input.addEventListener("input", () => {
    const result = parseCelsius(input!.value);

    switch (result.type) {
      case "empty": {
        errorMsg!.hidden = true;
        errorMsg!.textContent = "";
        input!.classList.remove("is-invalid");
        setOutputs("—", "—");
        emptyHint!.hidden = false;
        setAriaDescribedBy(["empty-hint"]);
        lastValid = null;
        break;
      }

      case "pending": {
        errorMsg!.hidden = true;
        errorMsg!.textContent = "";
        input!.classList.remove("is-invalid");
        emptyHint!.hidden = true;
        setAriaDescribedBy([]);
        // Preserve last-valid outputs; if none yet, — remains from initialisation.
        if (lastValid !== null) {
          setOutputs(lastValid.fahrenheit, lastValid.kelvin);
        }
        break;
      }

      case "valid": {
        errorMsg!.hidden = true;
        errorMsg!.textContent = "";
        input!.classList.remove("is-invalid");
        emptyHint!.hidden = true;
        setAriaDescribedBy([]);
        const f = `${formatNumber(celsiusToFahrenheit(result.value))} °F`;
        const k = `${formatNumber(celsiusToKelvin(result.value))} K`;
        setOutputs(f, k);
        lastValid = { fahrenheit: f, kelvin: k };
        break;
      }

      case "invalid": {
        emptyHint!.hidden = true;
        setOutputs("—", "—");
        const message = result.reason === "range" ? MSG_RANGE : MSG_FORMAT;
        errorMsg!.textContent = message; // textContent only — XSS safe
        errorMsg!.hidden = false;
        input!.classList.add("is-invalid");
        setAriaDescribedBy(["error-message"]);
        break;
      }
    }
  });
}

// ── Auto-init on real page load ───────────────────────────────────────────────

if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => initConverter(document));
  } else {
    // Already interactive/complete (e.g. deferred script)
    initConverter(document);
  }
}
