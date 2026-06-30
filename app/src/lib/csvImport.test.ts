import { describe, expect, it } from "vitest";
import { parseFinanceCsv, parseIncomeCsv } from "./csvImport";

describe("parseIncomeCsv", () => {
  it("returns valid income rows from a valid CSV", () => {
    const csv =
      "date,source,category,amount,currency,notes\n2026-06-01,Salary,salary,30000,HKD,June pay";

    expect(parseIncomeCsv(csv)).toEqual({
      validRows: [
        {
          date: "2026-06-01",
          source: "Salary",
          category: "salary",
          amount: 30000,
          currency: "HKD",
          notes: "June pay",
        },
      ],
      invalidRows: [],
    });
  });

  it("defaults optional category and currency for simple HKD imports", () => {
    const csv = "date,source,amount\n2026-06-01,Salary,30000";

    expect(parseIncomeCsv(csv)).toEqual({
      validRows: [
        {
          date: "2026-06-01",
          source: "Salary",
          category: "salary",
          amount: 30000,
          currency: "HKD",
          notes: "",
        },
      ],
      invalidRows: [],
    });
  });

  it("treats imported currency values as HKD", () => {
    const csv = "date,source,amount,currency\n2026-06-01,Salary,30000,USD";

    expect(parseIncomeCsv(csv).validRows[0].currency).toBe("HKD");
  });

  it("returns invalid row errors for invalid date and amount", () => {
    const csv = "date,source,category,amount,currency\nbad,Salary,salary,nope,HKD";
    const result = parseIncomeCsv(csv);

    expect(result.validRows).toEqual([]);
    expect(result.invalidRows).toHaveLength(1);
    expect(result.invalidRows[0]).toMatchObject({
      rowNumber: 2,
      raw: {
        date: "bad",
        source: "Salary",
        category: "salary",
        amount: "nope",
        currency: "HKD",
      },
    });
    expect(result.invalidRows[0].errors).toEqual(
      expect.arrayContaining(["Invalid date", "Invalid amount"]),
    );
  });
});

describe("parseFinanceCsv", () => {
  it("returns income and expense rows from one CSV", () => {
    const csv = [
      "type,date,name,amount,category,is_recurring,notes,payment_method",
      "income,2026-06-01,Salary,30000,salary,true,Monthly salary,",
      "expense,2026-06-02,Citysuper,480,food,false,Groceries,card",
    ].join("\n");

    expect(parseFinanceCsv(csv)).toEqual({
      validRows: [
        {
          type: "income",
          date: "2026-06-01",
          name: "Salary",
          category: "salary",
          amount: 30000,
          isRecurring: true,
          notes: "Monthly salary",
          paymentMethod: "",
        },
        {
          type: "expense",
          date: "2026-06-02",
          name: "Citysuper",
          category: "food",
          amount: 480,
          isRecurring: false,
          notes: "Groceries",
          paymentMethod: "card",
        },
      ],
      invalidRows: [],
    });
  });

  it("keeps the old income-only format valid as income rows", () => {
    const csv = "date,source,amount,category,notes\n2026-01-31,HSBC Payroll,32000,salary,Monthly salary";

    expect(parseFinanceCsv(csv).validRows[0]).toMatchObject({
      type: "income",
      date: "2026-01-31",
      name: "HSBC Payroll",
      amount: 32000,
      category: "salary",
      isRecurring: false,
    });
  });

  it("returns clear errors for invalid combined rows", () => {
    const csv = "type,date,name,amount\nexpense,bad,,nope";
    const result = parseFinanceCsv(csv);

    expect(result.validRows).toEqual([]);
    expect(result.invalidRows[0].errors).toEqual(
      expect.arrayContaining(["Invalid date", "Name is required", "Invalid amount"]),
    );
  });
});
