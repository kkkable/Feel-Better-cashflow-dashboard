import { describe, expect, it } from "vitest";
import { formatFeelBetterDefaultInput } from "./feelBetterDefaults";

describe("formatFeelBetterDefaultInput", () => {
  it("formats finite HKD amounts as editable number input values", () => {
    expect(formatFeelBetterDefaultInput(30000)).toBe("30000");
    expect(formatFeelBetterDefaultInput(22000.5)).toBe("22000.5");
    expect(formatFeelBetterDefaultInput(22000.55)).toBe("22000.55");
  });

  it("returns an empty input for missing or invalid amounts", () => {
    expect(formatFeelBetterDefaultInput(undefined)).toBe("");
    expect(formatFeelBetterDefaultInput(Number.NaN)).toBe("");
    expect(formatFeelBetterDefaultInput(Infinity)).toBe("");
  });
});
