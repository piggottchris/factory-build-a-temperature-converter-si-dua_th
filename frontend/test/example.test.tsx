import { describe, expect, it } from "vitest";

describe("template smoke", () => {
  it("vitest is wired up", () => {
    expect(1 + 1).toBe(2);
  });

  it("has access to jsdom", () => {
    const h1 = document.createElement("h1");
    h1.textContent = "hi";
    document.body.appendChild(h1);
    expect(document.querySelector("h1")?.textContent).toBe("hi");
  });
});
