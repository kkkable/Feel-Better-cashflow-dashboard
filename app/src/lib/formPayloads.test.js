import { describe, expect, it } from "vitest";
import {
  buildExpenseBucketPayload,
  buildExpenseRecordPayload,
  buildIncomePayload,
} from "./formPayloads";

describe("form payload helpers", () => {
  it("stores simple expense buckets as HKD with hidden defaults", () => {
    expect(buildExpenseBucketPayload({ name: "Rent", amount: "12000" })).toEqual({
      name: "Rent",
      category: "other",
      planned_monthly_amount_hkd: 12000,
      currency_original: "HKD",
      exchange_rate_to_hkd: 1,
      amount_original: 12000,
      is_active: true,
      notes: "",
    });
  });

  it("stores detailed expenses as HKD without FX input", () => {
    expect(
      buildExpenseRecordPayload({
        merchant: "Cafe",
        category: "food",
        amount: "88.5",
        date: "2026-06-26",
        paymentMethod: "card",
        isRecurring: false,
        notes: "lunch",
      }),
    ).toMatchObject({
      amount_original: 88.5,
      currency_original: "HKD",
      exchange_rate_to_hkd: 1,
      amount_hkd: 88.5,
      rate_source: "fixed",
    });
  });

  it("stores income as HKD without FX input", () => {
    expect(
      buildIncomePayload({
        source: "Salary",
        category: "salary",
        amount: "30000",
        date: "2026-06-26",
        isRecurring: true,
        notes: "June",
      }),
    ).toMatchObject({
      amount_original: 30000,
      currency_original: "HKD",
      exchange_rate_to_hkd: 1,
      amount_hkd: 30000,
      rate_source: "fixed",
      recurrence_frequency: "monthly",
    });
  });
});
