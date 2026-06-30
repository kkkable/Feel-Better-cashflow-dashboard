import { describe, expect, it } from "vitest";
import { convertToHkd, formatDashboardHkd, formatDashboardMoney, formatHkd, formatMoney, normalizeCurrency } from "./money";

describe("money utilities", () => {
  it("formats HKD with symbol and two decimal places", () => {
    expect(formatHkd(12345.6)).toBe("$12,345.60");
  });

  it("formats dashboard HKD without the HK prefix", () => {
    expect(formatDashboardHkd(12345.6)).toBe("$12,345.60");
  });

  it("formats selected non-HKD dashboard currency with symbol only", () => {
    expect(formatMoney(12345.6, "USD")).toBe("$12,345.60");
    expect(formatMoney(12345.6, "JPY")).toBe("\u00a512,345.60");
    expect(formatMoney(12345.6, "EUR")).toBe("\u20ac12,345.60");
    expect(formatDashboardMoney(12345.6, "USD")).toBe("$12,345.60");
  });

  it("converts an amount to HKD using the provided rate", () => {
    expect(convertToHkd(1000, 0.052)).toBe(52);
  });

  it("normalizes currency codes to uppercase", () => {
    expect(normalizeCurrency("jpy")).toBe("JPY");
  });

  it("falls back to HKD for unsupported currency codes", () => {
    expect(normalizeCurrency("doge")).toBe("HKD");
  });
});
