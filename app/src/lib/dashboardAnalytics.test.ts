import { describe, expect, it } from "vitest";
import {
  buildCategoryBreakdown,
  buildLastSixMonthsCashflow,
  buildRecurringMix,
  buildThisMonthMetrics,
} from "./dashboardAnalytics";

const incomeRecords = [
  { amount_hkd: 10000, date: "2026-06-01", is_recurring: true, recurrence_frequency: "monthly", source: "salary" },
  { amount_hkd: 400, date: "2026-06-20", is_recurring: false, source: "rebate" },
  { amount_hkd: 300, date: "2026-05-20", is_recurring: false, source: "refund" },
];

const expenseRecords = [
  { amount_hkd: 1500, date: "2026-06-10", is_recurring: true, category: "rent", merchant: "rent" },
  { amount_hkd: 60, date: "2026-06-11", is_recurring: false, category: "subscriptions", merchant: "youtube" },
  { amount_hkd: 80, date: "2026-06-12", is_recurring: false, category: "food", merchant: "dinner" },
  { amount_hkd: 50, date: "2026-05-12", is_recurring: false, category: "food", merchant: "lunch" },
];

describe("dashboard analytics", () => {
  it("calculates this-month metrics from the selected month", () => {
    const result = buildThisMonthMetrics({
      month: "2026-06",
      incomeRecords,
      expenseBuckets: [{ planned_monthly_amount_hkd: 2000, is_active: true }],
      expenseRecords,
    });

    expect(result).toMatchObject({
      month: "2026-06",
      incomeHkd: 10400,
      expenseHkd: 1640,
      netCashflowHkd: 8760,
      savingsRate: 84.23,
      recurringMonthlyIncomeHkd: 10000,
      recurringMonthlyExpenseHkd: 1500,
    });
  });

  it("builds last six months actual cashflow with empty months preserved", () => {
    const result = buildLastSixMonthsCashflow({
      endMonth: "2026-06",
      incomeRecords,
      expenseRecords,
    });

    expect(result).toHaveLength(6);
    expect(result[4]).toMatchObject({
      month: "2026-05",
      incomeHkd: 300,
      expenseHkd: 50,
      netCashflowHkd: 250,
    });
    expect(result[5]).toMatchObject({
      month: "2026-06",
      incomeHkd: 10400,
      expenseHkd: 1640,
      netCashflowHkd: 8760,
    });
  });

  it("groups this-month expenses by category", () => {
    const result = buildCategoryBreakdown({
      month: "2026-06",
      expenseRecords,
    });

    expect(result).toEqual([
      { category: "rent", amountHkd: 1500 },
      { category: "food", amountHkd: 80 },
      { category: "subscriptions", amountHkd: 60 },
    ]);
  });

  it("splits recurring and one-time money for current month", () => {
    const result = buildRecurringMix({
      month: "2026-06",
      incomeRecords,
      expenseBuckets: [{ planned_monthly_amount_hkd: 2000, is_active: true }],
      expenseRecords,
    });

    expect(result).toEqual({
      income: { recurringHkd: 10000, oneTimeHkd: 400 },
      expenses: { recurringHkd: 1500, oneTimeHkd: 140 },
    });
  });
});
