/**
 * Accessibility tests for the temperature-converter widget.
 *
 * Covers:
 *  1. axe-core zero-violation checks in EMPTY, VALID, INVALID, and PENDING states.
 *  2. Debounced screen-reader announcement assertion using vi.useFakeTimers().
 *  3. Visible DOM updates (#temp-result, #temp-error) for all widget states.
 *  4. Distinct error messages for format-invalid vs range-invalid inputs.
 *  5. #sr-error announcement fires after 400 ms debounce for invalid inputs.
 *
 * Environment: jsdom (configured in vitest.config.ts).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import axe from "axe-core";
import { mountTemperatureWidget } from "../lib/temperature-widget";

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

/**
 * Run axe against document.body and return the violations array.
 * Configured to skip known irrelevant rules for a demo jsdom document.
 */
async function runAxe(): Promise<axe.Result[]> {
  const results = await axe.run(document.body, {
    runOnly: {
      type: "tag",
      values: ["wcag2a", "wcag2aa", "best-practice"],
    },
  });
  return results.violations;
}

// ---------------------------------------------------------------------------
// axe-core zero-violation checks
// ---------------------------------------------------------------------------

describe("Temperature Converter — axe-core zero violations", () => {
  let container: HTMLElement;
  let unmount: () => void;

  beforeEach(() => {
    document.body.innerHTML = "";
    container = document.createElement("div");
    document.body.appendChild(container);
    unmount = mountTemperatureWidget(container);
  });

  afterEach(() => {
    unmount();
    document.body.innerHTML = "";
  });

  it("EMPTY state: zero axe violations", async () => {
    const violations = await runAxe();
    expect(violations).toHaveLength(0);
  });

  it("VALID state (input=100): zero axe violations", async () => {
    const input = document.querySelector<HTMLInputElement>("#temp-input")!;
    input.value = "100";
    input.dispatchEvent(new Event("input", { bubbles: true }));

    const violations = await runAxe();
    expect(violations).toHaveLength(0);
  });

  it("INVALID state (input=abc): zero axe violations", async () => {
    const input = document.querySelector<HTMLInputElement>("#temp-input")!;
    input.value = "abc";
    input.dispatchEvent(new Event("input", { bubbles: true }));

    const violations = await runAxe();
    expect(violations).toHaveLength(0);
  });

  it("PENDING state (input=-): zero axe violations", async () => {
    // "-" is a pending input — user started typing a negative number.
    // The widget renders a neutral state (no error, no result).
    const input = document.querySelector<HTMLInputElement>("#temp-input")!;
    input.value = "-";
    input.dispatchEvent(new Event("input", { bubbles: true }));

    const violations = await runAxe();
    expect(violations).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Announcement debounce assertion
// ---------------------------------------------------------------------------

describe("Temperature Converter — announcement debounce", () => {
  let container: HTMLElement;
  let unmount: () => void;

  beforeEach(() => {
    vi.useFakeTimers();
    document.body.innerHTML = "";
    container = document.createElement("div");
    document.body.appendChild(container);
    unmount = mountTemperatureWidget(container);
  });

  afterEach(() => {
    unmount();
    vi.useRealTimers();
    document.body.innerHTML = "";
  });

  it("SR regions stay silent during rapid keystrokes and announce after 400 ms", () => {
    const input = document.querySelector<HTMLInputElement>("#temp-input")!;
    const srResult = document.querySelector<HTMLElement>("#sr-result")!;
    const srError = document.querySelector<HTMLElement>("#sr-error")!;

    // Simulate 5 rapid keystrokes (each ~100 ms apart — well under the 400 ms threshold).
    // Final value is "100" which produces a valid result: 212.00 °F / 373.15 K.
    const keystrokes = ["1", "10", "100", "1000", "100"];

    for (const value of keystrokes) {
      input.value = value;
      input.dispatchEvent(new Event("input", { bubbles: true }));
      // Advance by 100 ms — less than the 400 ms debounce window.
      vi.advanceTimersByTime(100);
      // SR regions must remain empty: no announcement has fired yet.
      expect(srResult.textContent).toBe("");
      expect(srError.textContent).toBe("");
    }

    // Advance past the full debounce window for the last keystroke.
    vi.advanceTimersByTime(400);

    // The debounce timer has now fired for the final value "100" (100 °C).
    // 100 °C → 212.00 °F, 373.15 K
    expect(srResult.textContent).toContain("212.00");
    expect(srResult.textContent).toContain("373.15");
    // No error should be announced for a valid input.
    expect(srError.textContent).toBe("");
  });
});

// ---------------------------------------------------------------------------
// Reliability: double-mount and double-unmount safety
// ---------------------------------------------------------------------------

describe("Temperature Converter — reliability (idempotent cleanup / double-mount)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    document.body.innerHTML = "";
  });

  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = "";
  });

  it("double-unmount: calling cleanup twice does not throw", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const unmount = mountTemperatureWidget(container);
    expect(() => {
      unmount();
      unmount(); // second call must be a no-op, not an error
    }).not.toThrow();
  });

  it("zombie timer: a pending debounce from before cleanup does not write to the DOM after cleanup", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const unmount = mountTemperatureWidget(container);

    const input = container.querySelector<HTMLInputElement>("#temp-input")!;
    const srResult = container.querySelector<HTMLElement>("#sr-result")!;

    // Type a valid value to arm the debounce timer.
    input.value = "25";
    input.dispatchEvent(new Event("input", { bubbles: true }));

    // Advance halfway — timer is still pending.
    vi.advanceTimersByTime(200);
    expect(srResult.textContent).toBe(""); // not fired yet

    // Unmount while the timer is still pending.
    unmount();

    // Advance past the full debounce window.
    vi.advanceTimersByTime(400);

    // The zombie timer must NOT have written to the (now potentially orphaned)
    // SR element — the unmounted flag should have suppressed the callback.
    expect(srResult.textContent).toBe("");
  });

  it("double-mount: second mount replaces widget; first cleanup does not interfere", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);

    // First mount — arm a debounce timer, then abandon the cleanup.
    const unmount1 = mountTemperatureWidget(container);
    const input1 = container.querySelector<HTMLInputElement>("#temp-input")!;
    input1.value = "99";
    input1.dispatchEvent(new Event("input", { bubbles: true }));
    // (do NOT call unmount1 — simulates a caller that forgot)

    // Second mount — replaces innerHTML, orphaning the first widget's nodes.
    const unmount2 = mountTemperatureWidget(container);
    const input2 = container.querySelector<HTMLInputElement>("#temp-input")!;
    const srResult2 = container.querySelector<HTMLElement>("#sr-result")!;

    // Type a new value into the second widget.
    input2.value = "0";
    input2.dispatchEvent(new Event("input", { bubbles: true }));

    // Advance enough to fire both debounce windows.
    vi.advanceTimersByTime(500);

    // The second widget's SR region should show the result for 0 °C (32.00 °F / 273.15 K).
    expect(srResult2.textContent).toContain("32.00");
    // The orphaned first-mount timer must not have written garbage into the
    // second widget's SR element (it would have written "99 °C" data).
    expect(srResult2.textContent).not.toContain("210.20");

    unmount2();
  });
});

// ---------------------------------------------------------------------------
// Visible DOM updates (#temp-result, #temp-error)
// ---------------------------------------------------------------------------

describe("Temperature Converter — visible DOM updates", () => {
  let container: HTMLElement;
  let unmount: () => void;

  beforeEach(() => {
    vi.useFakeTimers();
    document.body.innerHTML = "";
    container = document.createElement("div");
    document.body.appendChild(container);
    unmount = mountTemperatureWidget(container);
  });

  afterEach(() => {
    unmount();
    vi.useRealTimers();
    document.body.innerHTML = "";
  });

  it("VALID state: #temp-result shows Fahrenheit and Kelvin, #temp-error is empty", () => {
    const input = container.querySelector<HTMLInputElement>("#temp-input")!;
    const tempResult = container.querySelector<HTMLElement>("#temp-result")!;
    const tempError = container.querySelector<HTMLElement>("#temp-error")!;

    input.value = "0";
    input.dispatchEvent(new Event("input", { bubbles: true }));

    // Visible result is updated immediately (not debounced).
    expect(tempResult.textContent).toBe("32.00 °F / 273.15 K");
    expect(tempError.textContent).toBe("");
  });

  it("INVALID (format) state: #temp-error shows format message, #temp-result is empty", () => {
    const input = container.querySelector<HTMLInputElement>("#temp-input")!;
    const tempResult = container.querySelector<HTMLElement>("#temp-result")!;
    const tempError = container.querySelector<HTMLElement>("#temp-error")!;

    input.value = "abc";
    input.dispatchEvent(new Event("input", { bubbles: true }));

    expect(tempResult.textContent).toBe("");
    expect(tempError.textContent).toContain("valid number");
  });

  it("INVALID (range) state: #temp-error shows range message distinct from format message", () => {
    const input = container.querySelector<HTMLInputElement>("#temp-input")!;
    const tempResult = container.querySelector<HTMLElement>("#temp-result")!;
    const tempError = container.querySelector<HTMLElement>("#temp-error")!;

    // 2000000 exceeds MAX_ABS (1_000_000) — triggers range error.
    input.value = "2000000";
    input.dispatchEvent(new Event("input", { bubbles: true }));

    expect(tempResult.textContent).toBe("");
    // Range error message must mention the allowed bounds.
    expect(tempError.textContent).toContain("1,000,000");
    // Range error message must NOT be the format error message.
    expect(tempError.textContent).not.toContain("valid number");
  });

  it("PENDING state: both #temp-result and #temp-error are empty", () => {
    const input = container.querySelector<HTMLInputElement>("#temp-input")!;
    const tempResult = container.querySelector<HTMLElement>("#temp-result")!;
    const tempError = container.querySelector<HTMLElement>("#temp-error")!;

    input.value = "-";
    input.dispatchEvent(new Event("input", { bubbles: true }));

    expect(tempResult.textContent).toBe("");
    expect(tempError.textContent).toBe("");
  });

  it("EMPTY state: both #temp-result and #temp-error are empty", () => {
    const input = container.querySelector<HTMLInputElement>("#temp-input")!;
    const tempResult = container.querySelector<HTMLElement>("#temp-result")!;
    const tempError = container.querySelector<HTMLElement>("#temp-error")!;

    // Start with a valid value, then clear it.
    input.value = "25";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.value = "";
    input.dispatchEvent(new Event("input", { bubbles: true }));

    expect(tempResult.textContent).toBe("");
    expect(tempError.textContent).toBe("");
  });
});

// ---------------------------------------------------------------------------
// #sr-error debounce announcement for invalid input
// ---------------------------------------------------------------------------

describe("Temperature Converter — sr-error debounce announcement", () => {
  let container: HTMLElement;
  let unmount: () => void;

  beforeEach(() => {
    vi.useFakeTimers();
    document.body.innerHTML = "";
    container = document.createElement("div");
    document.body.appendChild(container);
    unmount = mountTemperatureWidget(container);
  });

  afterEach(() => {
    unmount();
    vi.useRealTimers();
    document.body.innerHTML = "";
  });

  it("format-invalid: #sr-error is silent until 400 ms then announces format error", () => {
    const input = container.querySelector<HTMLInputElement>("#temp-input")!;
    const srError = container.querySelector<HTMLElement>("#sr-error")!;
    const srResult = container.querySelector<HTMLElement>("#sr-result")!;

    input.value = "xyz";
    input.dispatchEvent(new Event("input", { bubbles: true }));

    // SR region must be empty before the debounce window expires.
    expect(srError.textContent).toBe("");

    vi.advanceTimersByTime(400);

    // After debounce fires, #sr-error must contain the format error.
    expect(srError.textContent).toContain("valid number");
    // #sr-result must remain empty for an invalid input.
    expect(srResult.textContent).toBe("");
  });

  it("range-invalid: #sr-error announces range error (distinct from format error)", () => {
    const input = container.querySelector<HTMLInputElement>("#temp-input")!;
    const srError = container.querySelector<HTMLElement>("#sr-error")!;

    input.value = "9999999";
    input.dispatchEvent(new Event("input", { bubbles: true }));

    expect(srError.textContent).toBe("");

    vi.advanceTimersByTime(400);

    // Range message must mention the boundary, NOT the generic format hint.
    expect(srError.textContent).toContain("1,000,000");
    expect(srError.textContent).not.toContain("valid number");
  });

  it("rapid invalid keystrokes: #sr-error stays silent until final debounce fires", () => {
    const input = container.querySelector<HTMLInputElement>("#temp-input")!;
    const srError = container.querySelector<HTMLElement>("#sr-error")!;

    const strokes = ["x", "xy", "xyz", "xyza", "xyzab"];
    for (const value of strokes) {
      input.value = value;
      input.dispatchEvent(new Event("input", { bubbles: true }));
      vi.advanceTimersByTime(100);
      expect(srError.textContent).toBe("");
    }

    vi.advanceTimersByTime(400);
    expect(srError.textContent).toContain("valid number");
  });
});
