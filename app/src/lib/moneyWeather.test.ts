import { describe, expect, it } from "vitest";
import { getMoneyWeather } from "./moneyWeather";

describe("getMoneyWeather", () => {
  it("returns none when the account has no records", () => {
    expect(
      getMoneyWeather({
        hasRecords: false,
        currentIncomeHkd: 30000,
        currentExpenseHkd: 10000,
        projectedCashflowHkd: 20000,
      }),
    ).toBe("none");
  });

  it("returns sunny only when income has a 20 percent buffer and projection is positive", () => {
    expect(
      getMoneyWeather({
        hasRecords: true,
        currentIncomeHkd: 30000,
        currentExpenseHkd: 20000,
        projectedCashflowHkd: 1,
      }),
    ).toBe("sunny");
  });

  it("returns cloudy when income covers expense but does not have a 20 percent buffer", () => {
    expect(
      getMoneyWeather({
        hasRecords: true,
        currentIncomeHkd: 21000,
        currentExpenseHkd: 20000,
        projectedCashflowHkd: 1000,
      }),
    ).toBe("cloudy");
  });

  it("returns cloudy when the 20 percent buffer exists but projected cashflow is zero", () => {
    expect(
      getMoneyWeather({
        hasRecords: true,
        currentIncomeHkd: 30000,
        currentExpenseHkd: 20000,
        projectedCashflowHkd: 0,
      }),
    ).toBe("cloudy");
  });

  it("returns rainy when expense is higher than income or projection is negative", () => {
    expect(
      getMoneyWeather({
        hasRecords: true,
        currentIncomeHkd: 10000,
        currentExpenseHkd: 12000,
        projectedCashflowHkd: 1000,
      }),
    ).toBe("rainy");
    expect(
      getMoneyWeather({
        hasRecords: true,
        currentIncomeHkd: 30000,
        currentExpenseHkd: 10000,
        projectedCashflowHkd: -1,
      }),
    ).toBe("rainy");
  });
});
