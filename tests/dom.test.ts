/**
 * tests/dom.test.ts — jsdom DOM state-transition tests for src/main.ts
 *
 * These tests validate the EMPTY / PENDING / VALID / INVALID state machine
 * implemented in main.ts by:
 *   1. Loading the HTML fixture into jsdom
 *   2. Importing initConverter (the DOMContentLoaded handler logic)
 *   3. Dispatching synthetic `input` events and asserting DOM mutations
 */

import { describe, it, expect, beforeEach } from "vitest";
import { JSDOM } from "jsdom";

// ── Helpers ────────────────────────────────────────────────────────────────────

const HTML_FIXTURE = `<!doctype html>
<html lang="en">
<body>
  <input id="celsius-input" type="text" aria-describedby="empty-hint" />
  <p id="empty-hint">Type a temperature to convert.</p>
  <p id="error-message" hidden></p>
  <output id="fahrenheit-output">—</output>
  <output id="kelvin-output">—</output>
</body>
</html>`;

type DOMRefs = {
  input: HTMLInputElement;
  emptyHint: HTMLElement;
  errorMsg: HTMLElement;
  fahrenheit: HTMLOutputElement;
  kelvin: HTMLOutputElement;
};

function setupDOM(): { dom: JSDOM; refs: DOMRefs; triggerInput: (value: string) => void } {
  const dom = new JSDOM(HTML_FIXTURE);
  const { document } = dom.window;

  const refs: DOMRefs = {
    input: document.getElementById("celsius-input") as HTMLInputElement,
    emptyHint: document.getElementById("empty-hint") as HTMLElement,
    errorMsg: document.getElementById("error-message") as HTMLElement,
    fahrenheit: document.getElementById("fahrenheit-output") as HTMLOutputElement,
    kelvin: document.getElementById("kelvin-output") as HTMLOutputElement,
  };

  return {
    dom,
    refs,
    triggerInput: (value: string) => {
      refs.input.value = value;
      refs.input.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
    },
  };
}

// ── Import the module under test ───────────────────────────────────────────────
// initConverter is the public API — it wires listeners onto a given document.
import { initConverter } from "../src/main.ts";

// ── Test suite ─────────────────────────────────────────────────────────────────

describe("main.ts — DOM state machine", () => {
  let refs: DOMRefs;
  let triggerInput: (value: string) => void;

  beforeEach(() => {
    const setup = setupDOM();
    refs = setup.refs;
    triggerInput = setup.triggerInput;
    initConverter(setup.dom.window.document);
  });

  // ── EMPTY state ──────────────────────────────────────────────────────────────

  describe("EMPTY state (blank input)", () => {
    it("outputs display — on initial render", () => {
      expect(refs.fahrenheit.textContent).toBe("—");
      expect(refs.kelvin.textContent).toBe("—");
    });

    it("shows empty-hint", () => {
      expect(refs.emptyHint.hidden).toBe(false);
    });

    it("hides error slot", () => {
      expect(refs.errorMsg.hidden).toBe(true);
    });

    it("outputs revert to — after clearing a valid value", () => {
      triggerInput("100");
      triggerInput("");
      expect(refs.fahrenheit.textContent).toBe("—");
      expect(refs.kelvin.textContent).toBe("—");
    });

    it("empty-hint reappears after clearing", () => {
      triggerInput("100");
      triggerInput("");
      expect(refs.emptyHint.hidden).toBe(false);
    });

    it("aria-describedby excludes error ID when empty", () => {
      triggerInput("abc"); // go invalid first to set aria-describedby
      triggerInput("");    // back to empty
      const described = refs.input.getAttribute("aria-describedby") ?? "";
      expect(described).not.toContain("error-message");
    });
  });

  // ── PENDING state ────────────────────────────────────────────────────────────

  describe("PENDING state (partial input)", () => {
    it("does not show error for lone minus sign", () => {
      triggerInput("-");
      expect(refs.errorMsg.hidden).toBe(true);
    });

    it("does not show error for trailing decimal point", () => {
      triggerInput("36.");
      expect(refs.errorMsg.hidden).toBe(true);
    });

    it("does not show error for -. sequence", () => {
      triggerInput("-.");
      expect(refs.errorMsg.hidden).toBe(true);
    });

    it("does not show error for lone plus sign", () => {
      triggerInput("+");
      expect(refs.errorMsg.hidden).toBe(true);
    });

    it("does not show error for partial scientific notation (trailing E)", () => {
      triggerInput("1e");
      expect(refs.errorMsg.hidden).toBe(true);
    });

    it("does not show error for partial scientific notation (uppercase trailing E)", () => {
      triggerInput("1E");
      expect(refs.errorMsg.hidden).toBe(true);
    });

    it("does not show error for partial scientific notation (E with sign but no digits)", () => {
      triggerInput("1e+");
      expect(refs.errorMsg.hidden).toBe(true);
    });

    it("does not show error for partial scientific notation (E- partial)", () => {
      triggerInput("1e-");
      expect(refs.errorMsg.hidden).toBe(true);
    });

    it("hides empty-hint while pending", () => {
      triggerInput("-");
      expect(refs.emptyHint.hidden).toBe(true);
    });

    it("keeps outputs at — when there is no prior valid value", () => {
      triggerInput("-");
      expect(refs.fahrenheit.textContent).toBe("—");
      expect(refs.kelvin.textContent).toBe("—");
    });

    it("preserves last-valid outputs during pending after a valid entry", () => {
      triggerInput("0");
      const prevF = refs.fahrenheit.textContent;
      const prevK = refs.kelvin.textContent;
      triggerInput("0.");
      expect(refs.fahrenheit.textContent).toBe(prevF);
      expect(refs.kelvin.textContent).toBe(prevK);
    });
  });

  // ── VALID state ───────────────────────────────────────────────────────────────

  describe("VALID state", () => {
    it("shows 212.00 °F for 100 °C", () => {
      triggerInput("100");
      expect(refs.fahrenheit.textContent).toBe("212.00 °F");
    });

    it("shows 373.15 K for 100 °C", () => {
      triggerInput("100");
      expect(refs.kelvin.textContent).toBe("373.15 K");
    });

    it("shows 32.00 °F for 0 °C", () => {
      triggerInput("0");
      expect(refs.fahrenheit.textContent).toBe("32.00 °F");
    });

    it("shows 273.15 K for 0 °C", () => {
      triggerInput("0");
      expect(refs.kelvin.textContent).toBe("273.15 K");
    });

    it("shows -40.00 °F for -40 °C", () => {
      triggerInput("-40");
      expect(refs.fahrenheit.textContent).toBe("-40.00 °F");
    });

    it("hides error slot on valid input", () => {
      triggerInput("100");
      expect(refs.errorMsg.hidden).toBe(true);
    });

    it("hides empty-hint on valid input", () => {
      triggerInput("100");
      expect(refs.emptyHint.hidden).toBe(true);
    });

    it("accepts boundary value 1000000", () => {
      triggerInput("1000000");
      expect(refs.errorMsg.hidden).toBe(true);
    });

    it("accepts boundary value -1000000", () => {
      triggerInput("-1000000");
      expect(refs.errorMsg.hidden).toBe(true);
    });

    it("accepts scientific notation 1e6 as valid (= 1,000,000)", () => {
      triggerInput("1e6");
      expect(refs.errorMsg.hidden).toBe(true);
      expect(refs.fahrenheit.textContent).toBe("1800032.00 °F");
    });

    it("accepts Unicode minus sign (U+2212) by normalising to ASCII hyphen", () => {
      triggerInput("−40"); // −40
      expect(refs.errorMsg.hidden).toBe(true);
      expect(refs.fahrenheit.textContent).toBe("-40.00 °F");
    });
  });

  // ── INVALID — format error ────────────────────────────────────────────────────

  describe("INVALID state — format error", () => {
    it("shows format error for alphabetic input", () => {
      triggerInput("abc");
      expect(refs.errorMsg.hidden).toBe(false);
      expect(refs.errorMsg.textContent).toBe(
        'Please enter a valid number (use "." as the decimal point, e.g. 36.6 or -40).'
      );
    });

    it("shows format error for mixed input", () => {
      triggerInput("1a2");
      expect(refs.errorMsg.hidden).toBe(false);
    });

    it("shows format error for hex notation (0x10)", () => {
      triggerInput("0x10");
      expect(refs.errorMsg.hidden).toBe(false);
    });

    it("shows format error for binary notation (0b10)", () => {
      triggerInput("0b10");
      expect(refs.errorMsg.hidden).toBe(false);
    });

    it("shows format error for underscore-separated number (1_000)", () => {
      triggerInput("1_000");
      expect(refs.errorMsg.hidden).toBe(false);
    });

    it("outputs revert to — on format error", () => {
      triggerInput("100");
      triggerInput("abc");
      expect(refs.fahrenheit.textContent).toBe("—");
      expect(refs.kelvin.textContent).toBe("—");
    });

    it("hides empty-hint on format error", () => {
      triggerInput("abc");
      expect(refs.emptyHint.hidden).toBe(true);
    });

    it("error message written via textContent not innerHTML", () => {
      // Inject a string that would execute as HTML if innerHTML were used
      triggerInput("<img src=x onerror=alert(1)>");
      // If textContent is used, the raw string appears verbatim (not as a node)
      const content = refs.errorMsg.textContent ?? "";
      // The content should be the format error, NOT an empty string (innerHTML XSS)
      // AND the document should not have an <img> injected into the error slot
      const img = (refs.errorMsg as Element).querySelector("img");
      expect(img).toBeNull();
    });
  });

  // ── INVALID — range error ─────────────────────────────────────────────────────

  describe("INVALID state — range error", () => {
    it("shows range error for value above 1 000 000", () => {
      triggerInput("1000001");
      expect(refs.errorMsg.hidden).toBe(false);
      expect(refs.errorMsg.textContent).toBe(
        "Enter a value between -1,000,000 and 1,000,000 °C."
      );
    });

    it("shows range error for value below -1 000 000", () => {
      triggerInput("-1000001");
      expect(refs.errorMsg.hidden).toBe(false);
      expect(refs.errorMsg.textContent).toBe(
        "Enter a value between -1,000,000 and 1,000,000 °C."
      );
    });

    it("outputs revert to — on range error", () => {
      triggerInput("100");
      triggerInput("2000000");
      expect(refs.fahrenheit.textContent).toBe("—");
      expect(refs.kelvin.textContent).toBe("—");
    });

    it("hides empty-hint on range error", () => {
      triggerInput("2000000");
      expect(refs.emptyHint.hidden).toBe(true);
    });
  });

  // ── XSS guard ────────────────────────────────────────────────────────────────

  describe("XSS safety", () => {
    it("uses textContent exclusively (no child nodes added via innerHTML)", () => {
      triggerInput("<script>alert(1)</script>");
      // If innerHTML were used the script tag would appear as a child element
      const children = Array.from((refs.errorMsg as Element).children);
      expect(children.length).toBe(0);
    });
  });

  // ── is-invalid CSS class mutations ───────────────────────────────────────────

  describe("is-invalid CSS class", () => {
    it("adds is-invalid class on format error", () => {
      triggerInput("abc");
      expect(refs.input.classList.contains("is-invalid")).toBe(true);
    });

    it("adds is-invalid class on range error", () => {
      triggerInput("2000000");
      expect(refs.input.classList.contains("is-invalid")).toBe(true);
    });

    it("removes is-invalid class when input clears (empty state)", () => {
      triggerInput("abc");
      triggerInput("");
      expect(refs.input.classList.contains("is-invalid")).toBe(false);
    });

    it("removes is-invalid class when input becomes valid after invalid", () => {
      triggerInput("abc");
      triggerInput("100");
      expect(refs.input.classList.contains("is-invalid")).toBe(false);
    });

    it("removes is-invalid class when input becomes pending after invalid", () => {
      triggerInput("abc");
      triggerInput("-");
      expect(refs.input.classList.contains("is-invalid")).toBe(false);
    });

    it("is-invalid is absent on initial render (before any input)", () => {
      expect(refs.input.classList.contains("is-invalid")).toBe(false);
    });
  });

  // ── aria-describedby transitions ──────────────────────────────────────────────

  describe("aria-describedby transitions", () => {
    it("sets aria-describedby to error-message on invalid state", () => {
      triggerInput("abc");
      expect(refs.input.getAttribute("aria-describedby")).toBe("error-message");
    });

    it("removes aria-describedby entirely on valid state", () => {
      triggerInput("abc");  // goes invalid → sets aria-describedby
      triggerInput("100");  // goes valid → should remove aria-describedby
      expect(refs.input.hasAttribute("aria-describedby")).toBe(false);
    });

    it("removes aria-describedby entirely on pending state", () => {
      triggerInput("abc");  // goes invalid → sets aria-describedby
      triggerInput("-");    // goes pending → should remove aria-describedby
      expect(refs.input.hasAttribute("aria-describedby")).toBe(false);
    });

    it("sets aria-describedby to empty-hint on empty state", () => {
      triggerInput("abc");  // goes invalid
      triggerInput("");     // back to empty
      expect(refs.input.getAttribute("aria-describedby")).toBe("empty-hint");
    });
  });

  // ── Transition sequences (multi-step flows) ───────────────────────────────────

  describe("multi-step transition sequences", () => {
    it("valid → invalid → empty: outputs show — at end", () => {
      triggerInput("100");    // valid
      triggerInput("abc");    // invalid
      triggerInput("");       // empty
      expect(refs.fahrenheit.textContent).toBe("—");
      expect(refs.kelvin.textContent).toBe("—");
      expect(refs.emptyHint.hidden).toBe(false);
      expect(refs.errorMsg.hidden).toBe(true);
    });

    it("invalid → valid: error clears and correct output appears", () => {
      triggerInput("abc");    // invalid
      triggerInput("0");      // valid
      expect(refs.errorMsg.hidden).toBe(true);
      expect(refs.fahrenheit.textContent).toBe("32.00 °F");
      expect(refs.kelvin.textContent).toBe("273.15 K");
    });

    it("pending → valid: outputs update when complete number entered", () => {
      triggerInput("10");     // valid first to establish lastValid
      triggerInput("10.");    // pending
      triggerInput("100");    // valid
      expect(refs.fahrenheit.textContent).toBe("212.00 °F");
      expect(refs.kelvin.textContent).toBe("373.15 K");
    });

    it("valid → pending: retains last-valid outputs during pending", () => {
      triggerInput("100");    // valid
      triggerInput("100.");   // pending (trailing dot)
      expect(refs.fahrenheit.textContent).toBe("212.00 °F");
      expect(refs.kelvin.textContent).toBe("373.15 K");
      expect(refs.errorMsg.hidden).toBe(true);
    });

    it("range-error → valid → empty: full round-trip", () => {
      triggerInput("9999999"); // range error
      expect(refs.errorMsg.hidden).toBe(false);
      triggerInput("-40");     // valid
      expect(refs.errorMsg.hidden).toBe(true);
      expect(refs.fahrenheit.textContent).toBe("-40.00 °F");
      triggerInput("");        // empty
      expect(refs.fahrenheit.textContent).toBe("—");
      expect(refs.emptyHint.hidden).toBe(false);
    });
  });

  // ── Boundary output values ────────────────────────────────────────────────────

  describe("boundary output values", () => {
    it("1000000 °C → 1800032.00 °F", () => {
      triggerInput("1000000");
      expect(refs.fahrenheit.textContent).toBe("1800032.00 °F");
    });

    it("1000000 °C → 1000273.15 K", () => {
      triggerInput("1000000");
      expect(refs.kelvin.textContent).toBe("1000273.15 K");
    });

    it("-1000000 °C → -1799968.00 °F", () => {
      triggerInput("-1000000");
      expect(refs.fahrenheit.textContent).toBe("-1799968.00 °F");
    });

    it("-1000000 °C → -999726.85 K", () => {
      triggerInput("-1000000");
      expect(refs.kelvin.textContent).toBe("-999726.85 K");
    });
  });
});
