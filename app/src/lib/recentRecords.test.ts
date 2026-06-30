import { describe, expect, it } from "vitest";
import { getRecentNonMonthlyRecords } from "./recentRecords";

describe("getRecentNonMonthlyRecords", () => {
  it("returns the latest three non-monthly records", () => {
    const result = getRecentNonMonthlyRecords([
      { id: "monthly", date: "2026-06-28", is_recurring: true },
      { id: "oldest", date: "2026-06-01", is_recurring: false },
      { id: "latest", date: "2026-06-27", is_recurring: false },
      { id: "middle", date: "2026-06-20", is_recurring: false },
      { id: "third", date: "2026-06-10", is_recurring: false },
    ]);

    expect(result.map((record) => record.id)).toEqual(["latest", "middle", "third"]);
  });

  it("treats recurrence frequency monthly as monthly even when the boolean is missing", () => {
    const result = getRecentNonMonthlyRecords([
      { id: "salary", date: "2026-06-28", recurrence_frequency: "monthly" },
      { id: "rebate", date: "2026-06-27", recurrence_frequency: "none" },
    ]);

    expect(result.map((record) => record.id)).toEqual(["rebate"]);
  });
});
