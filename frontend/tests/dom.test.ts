/**
 * DOM state-transition tests for the temperature-converter UI (lib/main.ts).
 *
 * Vitest runs these with jsdom (configured globally in vitest.config.ts), so
 * `document` is available.  Each `beforeEach` resets `document.body.innerHTML`
 * to a fresh fixture and calls `init()` — this ensures the module-level
 * closure state (lastValidF / lastValidK) inside each `init()` call is always
 * brand-new, without needing vi.resetModules().
 */

import { describe, it, expect, beforeEach } from "vitest";
import { init, FORMAT_ERROR_MSG, RANGE_ERROR_MSG } from "../lib/main";
import { MAX_LENGTH } from "../lib/convert";

// ---------------------------------------------------------------------------
// HTML fixture — mirrors the structure expected by lib/main.ts
// ---------------------------------------------------------------------------

const FIXTURE = `
  <input id="celsius-input" type="text" value="" />
  <button id="sign-toggle" type="button">±</button>
  <p id="empty-hint">Enter a temperature in Celsius</p>
  <p id="helper-text">Decimals and negatives OK. Use &quot;.&quot; as the decimal point.</p>
  <p id="error-slot" hidden></p>
  <p id="fahrenheit-output">—</p>
  <p id="kelvin-output">—</p>
  <p id="context-line" hidden></p>
`;

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function el<T extends HTMLElement = HTMLElement>(id: string): T {
  const found = document.getElementById(id) as T | null;
  if (!found) throw new Error(`Element #${id} not found in fixture`);
  return found;
}

function setInput(value: string): void {
  const input = el<HTMLInputElement>("celsius-input");
  input.value = value;
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

function clickSign(): void {
  el("sign-toggle").click();
}

function setup(): void {
  document.body.innerHTML = FIXTURE;
  init();
}

// ---------------------------------------------------------------------------
// 1. Initial EMPTY state
// ---------------------------------------------------------------------------

describe("dom — initial EMPTY state", () => {
  beforeEach(setup);

  it("outputs show em-dash", () => {
    expect(el("fahrenheit-output").textContent).toBe("—");
    expect(el("kelvin-output").textContent).toBe("—");
  });

  it("error slot is hidden", () => {
    expect(el("error-slot").hidden).toBe(true);
  });

  it("empty-hint is visible", () => {
    expect(el("empty-hint").hidden).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 2. Valid input: 100 °C
// ---------------------------------------------------------------------------

describe("dom — valid input: 100 °C", () => {
  beforeEach(setup);

  it("shows 212.00 °F", () => {
    setInput("100");
    expect(el("fahrenheit-output").textContent).toBe("212.00 °F");
  });

  it("shows 373.15 K", () => {
    setInput("100");
    expect(el("kelvin-output").textContent).toBe("373.15 K");
  });

  it("hides error slot", () => {
    setInput("100");
    expect(el("error-slot").hidden).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 3. Valid inputs: 0, -40, 36.6
// ---------------------------------------------------------------------------

describe("dom — valid inputs: 0, -40, 36.6", () => {
  beforeEach(setup);

  it("converts 0 °C → 32.00 °F, 273.15 K", () => {
    setInput("0");
    expect(el("fahrenheit-output").textContent).toBe("32.00 °F");
    expect(el("kelvin-output").textContent).toBe("273.15 K");
  });

  it("converts -40 °C → -40.00 °F, 233.15 K (crossover point)", () => {
    setInput("-40");
    expect(el("fahrenheit-output").textContent).toBe("-40.00 °F");
    expect(el("kelvin-output").textContent).toBe("233.15 K");
  });

  it("converts 36.6 °C → 97.88 °F, 309.75 K (body temperature)", () => {
    setInput("36.6");
    expect(el("fahrenheit-output").textContent).toBe("97.88 °F");
    expect(el("kelvin-output").textContent).toBe("309.75 K");
  });
});

// ---------------------------------------------------------------------------
// 4. Invalid input: format error (abc)
// ---------------------------------------------------------------------------

describe("dom — invalid input: format error", () => {
  beforeEach(setup);

  it("shows error slot for 'abc'", () => {
    setInput("abc");
    expect(el("error-slot").hidden).toBe(false);
  });

  it("shows exact FORMAT_ERROR_MSG for 'abc'", () => {
    setInput("abc");
    expect(el("error-slot").textContent).toBe(FORMAT_ERROR_MSG);
  });

  it("outputs show em-dash for 'abc'", () => {
    setInput("abc");
    expect(el("fahrenheit-output").textContent).toBe("—");
    expect(el("kelvin-output").textContent).toBe("—");
  });
});

// ---------------------------------------------------------------------------
// 5. Invalid input: range error (1500000)
// ---------------------------------------------------------------------------

describe("dom — invalid input: range error", () => {
  beforeEach(setup);

  it("shows error slot for '1500000'", () => {
    setInput("1500000");
    expect(el("error-slot").hidden).toBe(false);
  });

  it("shows exact RANGE_ERROR_MSG for '1500000'", () => {
    setInput("1500000");
    expect(el("error-slot").textContent).toBe(RANGE_ERROR_MSG);
  });

  it("outputs show em-dash for '1500000'", () => {
    setInput("1500000");
    expect(el("fahrenheit-output").textContent).toBe("—");
    expect(el("kelvin-output").textContent).toBe("—");
  });
});

// ---------------------------------------------------------------------------
// 6. Context line: valid then invalid
// ---------------------------------------------------------------------------

describe("dom — context line after valid → invalid", () => {
  beforeEach(setup);

  it("shows context line after 100 then abc", () => {
    setInput("100");
    setInput("abc");
    expect(el("context-line").hidden).toBe(false);
  });

  it("context line reads 'was: 212.00 °F · 373.15 K'", () => {
    setInput("100");
    setInput("abc");
    expect(el("context-line").textContent).toBe("was: 212.00 °F · 373.15 K");
  });
});

// ---------------------------------------------------------------------------
// 7. Clear input after error
// ---------------------------------------------------------------------------

describe("dom — clear input after error", () => {
  beforeEach(() => {
    setup();
    setInput("100");
    setInput("abc");
    setInput(""); // clear
  });

  it("hides error slot", () => {
    expect(el("error-slot").hidden).toBe(true);
  });

  it("shows empty-hint", () => {
    expect(el("empty-hint").hidden).toBe(false);
  });

  it("outputs show em-dash", () => {
    expect(el("fahrenheit-output").textContent).toBe("—");
    expect(el("kelvin-output").textContent).toBe("—");
  });

  it("hides context line", () => {
    expect(el("context-line").hidden).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 8. Pending inputs: error stays hidden, outputs unchanged
// ---------------------------------------------------------------------------

describe("dom — pending inputs", () => {
  const pendingValues = ["-", ".", "-.", "1."];

  pendingValues.forEach((pending) => {
    describe(`pending "${pending}"`, () => {
      beforeEach(() => {
        setup();
        setInput("100"); // establish a valid state first
      });

      it(`error slot stays hidden for "${pending}"`, () => {
        setInput(pending);
        expect(el("error-slot").hidden).toBe(true);
      });

      it(`fahrenheit output is unchanged for "${pending}"`, () => {
        setInput(pending);
        expect(el("fahrenheit-output").textContent).toBe("212.00 °F");
      });

      it(`kelvin output is unchanged for "${pending}"`, () => {
        setInput(pending);
        expect(el("kelvin-output").textContent).toBe("373.15 K");
      });
    });
  });
});

// ---------------------------------------------------------------------------
// 9 & 10. ± sign-toggle button
// ---------------------------------------------------------------------------

describe("dom — ± sign-toggle button", () => {
  beforeEach(setup);

  it("toggles 36.6 → -36.6 and updates outputs", () => {
    setInput("36.6");
    clickSign();
    expect(el<HTMLInputElement>("celsius-input").value).toBe("-36.6");
    expect(el("fahrenheit-output").textContent).toBe("-33.88 °F");
    expect(el("kelvin-output").textContent).toBe("236.55 K");
  });

  it("is a no-op for empty input", () => {
    clickSign(); // input is still ''
    expect(el<HTMLInputElement>("celsius-input").value).toBe("");
    expect(el("fahrenheit-output").textContent).toBe("—");
    expect(el("kelvin-output").textContent).toBe("—");
  });
});

// ---------------------------------------------------------------------------
// 11. Exact error-message strings (exported constants)
// ---------------------------------------------------------------------------

describe("dom — exact error-message string values", () => {
  it("FORMAT_ERROR_MSG matches PRD verbatim", () => {
    expect(FORMAT_ERROR_MSG).toBe(
      "Invalid format — only decimal numbers are accepted (e.g. -23.5)."
    );
  });

  it("RANGE_ERROR_MSG matches PRD verbatim", () => {
    expect(RANGE_ERROR_MSG).toBe(
      "Out of range — enter a value between -1 000 000 and 1 000 000."
    );
  });
});

// ---------------------------------------------------------------------------
// 12 & 13. Static copy text
// ---------------------------------------------------------------------------

describe("dom — static copy text", () => {
  beforeEach(setup);

  it("helper-text content matches spec", () => {
    expect(el("helper-text").textContent).toBe(
      'Decimals and negatives OK. Use "." as the decimal point.'
    );
  });

  it("empty-hint text matches spec", () => {
    expect(el("empty-hint").textContent).toBe("Enter a temperature in Celsius");
  });
});

// ---------------------------------------------------------------------------
// 14. Security: maxLength enforcement on #celsius-input
// ---------------------------------------------------------------------------

describe("dom — input maxLength enforcement", () => {
  beforeEach(setup);

  it("init() sets maxLength on #celsius-input to MAX_LENGTH", () => {
    expect(el<HTMLInputElement>("celsius-input").maxLength).toBe(MAX_LENGTH);
  });

  it("maxLength equals the parser length cap (32)", () => {
    // If MAX_LENGTH ever changes in convert.ts, this test will remind us to
    // re-verify that both the DOM attribute and the parser stay in sync.
    expect(MAX_LENGTH).toBe(32);
    expect(el<HTMLInputElement>("celsius-input").maxLength).toBe(32);
  });
});
