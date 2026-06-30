import { describe, expect, it } from "vitest";
import { buildMonthlyProjection } from "./projections";

describe("buildMonthlyProjection", () => {
  it("uses recurring income and actual recurring expenses", () => {
    const result = buildMonthlyProjection({
      months: 2,
      startMonth: "2026-06",
      includeActualSpending: true,
      incomeRecords: [
        { amount_hkd: 30000, date: "2026-06-01", is_recurring: true, recurrence_frequency: "monthly" },
        { amount_hkd: 6000, date: "2026-05-10", is_recurring: false, recurrence_frequency: "none" }
      ],
      expenseBuckets: [
        { planned_monthly_amount_hkd: 12000, is_active: true },
        { planned_monthly_amount_hkd: 1000, is_active: false }
      ],
      expenseRecords: [{ amount_hkd: 8000, date: "2026-06-01", is_recurring: true }]
    });

    expect(result[0]).toMatchObject({
      month: "2026-06",
      projectedIncomeHkd: 30000,
      projectedExpensesHkd: 8000,
      projectedCashflowHkd: 22000,
      projectedBalanceHkd: 22000
    });
    expect(result[1].month).toBe("2026-07");
  });

  it("can include current-month detailed actual spending", () => {
    const result = buildMonthlyProjection({
      months: 1,
      startMonth: "2026-06",
      includeActualSpending: true,
      incomeRecords: [{ amount_hkd: 30000, date: "2026-06-01", is_recurring: true, recurrence_frequency: "monthly" }],
      expenseBuckets: [{ planned_monthly_amount_hkd: 10000, is_active: true }],
      expenseRecords: [
        { amount_hkd: 2000, date: "2026-06-01", is_recurring: false },
        { amount_hkd: 4000, date: "2026-05-01", is_recurring: false }
      ]
    });

    expect(result[0].projectedExpensesHkd).toBe(2000);
    expect(result[0].projectedCashflowHkd).toBe(28000);
  });

  it("includes one-time actual expenses in projections", () => {
    const result = buildMonthlyProjection({
      months: 2,
      startMonth: "2026-06",
      includeActualSpending: true,
      incomeRecords: [
        { amount_hkd: 10000, date: "2026-06-01", is_recurring: true, recurrence_frequency: "monthly" }
      ],
      expenseBuckets: [{ planned_monthly_amount_hkd: 3000, is_active: true }],
      expenseRecords: [
        { amount_hkd: 500, date: "2026-06-15", is_recurring: false },
        { amount_hkd: 700, date: "2026-07-15", is_recurring: false },
        { amount_hkd: 1200, date: "2026-06-01", is_recurring: true }
      ]
    });

    expect(result.map((row) => row.projectedExpensesHkd)).toEqual([1700, 1900]);
    expect(result.map((row) => row.projectedCashflowHkd)).toEqual([8300, 8100]);
  });


  it("ignores non-recurring expenses outside the projected month", () => {
    const result = buildMonthlyProjection({
      months: 1,
      startMonth: "2026-06",
      includeActualSpending: true,
      incomeRecords: [],
      expenseBuckets: [],
      expenseRecords: [
        { amount_hkd: 1000, date: "2026-05-01", is_recurring: false },
        { amount_hkd: 2000, date: "2026-05-20", is_recurring: false },
        { amount_hkd: 9000, date: "2026-02-01", is_recurring: false }
      ]
    });

    expect(result[0].projectedExpensesHkd).toBe(0);
    expect(result[0].projectedCashflowHkd).toBe(0);
  });

  it("applies non-recurring records only to their own projected month", () => {
    const result = buildMonthlyProjection({
      months: 3,
      startMonth: "2026-06",
      includeActualSpending: true,
      incomeRecords: [
        { amount_hkd: 10000, date: "2026-06-01", is_recurring: true, recurrence_frequency: "monthly" },
        { amount_hkd: 400, date: "2026-08-10", is_recurring: false, recurrence_frequency: "none" }
      ],
      expenseBuckets: [],
      expenseRecords: [
        { amount_hkd: 1500, date: "2026-07-15", is_recurring: false }
      ]
    });

    expect(result.map((row) => row.projectedCashflowHkd)).toEqual([10000, 8500, 10400]);
    expect(result.map((row) => row.projectedBalanceHkd)).toEqual([10000, 18500, 28900]);
  });

  it("rejects invalid start months", () => {
    expect(() =>
      buildMonthlyProjection({
        months: 1,
        startMonth: "2026-13",
        includeActualSpending: false,
        incomeRecords: [],
        expenseBuckets: [],
        expenseRecords: []
      })
    ).toThrow("Invalid startMonth");
  });

  it("rejects invalid projection month counts", () => {
    expect(() =>
      buildMonthlyProjection({
        months: -1,
        startMonth: "2026-06",
        includeActualSpending: false,
        incomeRecords: [],
        expenseBuckets: [],
        expenseRecords: []
      })
    ).toThrow("Invalid projection months");

    expect(() =>
      buildMonthlyProjection({
        months: 1.5,
        startMonth: "2026-06",
        includeActualSpending: false,
        incomeRecords: [],
        expenseBuckets: [],
        expenseRecords: []
      })
    ).toThrow("Invalid projection months");
  });
});
