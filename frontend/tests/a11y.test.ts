/**
 * Accessibility tests for the temperature-converter widget.
 *
 * Covers:
 *  1. axe-core zero-violation checks in EMPTY, VALID, and INVALID states.
 *  2. Debounced screen-reader announcement assertion using vi.useFakeTimers().
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
