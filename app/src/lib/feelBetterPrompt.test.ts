import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("../../base44/functions/feelBetterReview/index.ts", import.meta.url), "utf8");

describe("Feel Better prompt currency context", () => {
  it("maps every supported currency to a practical local context", () => {
    expect(source).toContain('HKD: "Hong Kong"');
    expect(source).toContain('USD: "United States"');
    expect(source).toContain('JPY: "Japan"');
    expect(source).toContain('EUR: "Eurozone and Europe"');
    expect(source).toContain('GBP: "United Kingdom"');
    expect(source).toContain('CNY: "Mainland China"');
    expect(source).toContain('TWD: "Taiwan"');
    expect(source).toContain('SGD: "Singapore"');
    expect(source).toContain('AUD: "Australia"');
    expect(source).toContain('CAD: "Canada"');
  });

  it("prevents non-HKD reviews from falling back to Hong Kong advice", () => {
    expect(source).toContain("Currency context: ${currencyContext}");
    expect(source).toContain("Do not mention Hong Kong or HKD");
    expect(source).toContain("Use the selected currency's region for cost-of-living and banking context.");
    expect(source).not.toContain("You are a friendly money coach for a Hong Kong personal finance app.");
  });
});
