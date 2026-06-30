import { describe, expect, it } from "vitest";
import {
  INCOME_CSV_TEMPLATE_FILENAME,
  INCOME_CSV_TEMPLATE_TEXT,
  getIncomeCsvTemplateHref,
  getIncomeCsvTemplateText,
} from "./incomeCsvTemplate";

describe("income CSV template", () => {
  it("uses the import parser columns and HKD example rows", () => {
    expect(INCOME_CSV_TEMPLATE_FILENAME).toBe("finance-records-import-template.csv");
    expect(INCOME_CSV_TEMPLATE_TEXT.split("\n")[0]).toBe(
      "type,date,name,amount,category,is_recurring,notes,payment_method",
    );
    expect(INCOME_CSV_TEMPLATE_TEXT).toContain("income,2026-06-01,Salary,30000,salary,true,Monthly salary,");
    expect(INCOME_CSV_TEMPLATE_TEXT).toContain("expense,2026-06-03,MTR,360,transport,true,Monthly transit,Octopus");
  });

  it("returns a downloadable CSV data URL", () => {
    expect(getIncomeCsvTemplateHref()).toBe(
      `data:text/csv;charset=utf-8,${encodeURIComponent(INCOME_CSV_TEMPLATE_TEXT)}`,
    );
  });

  it("returns Traditional Chinese example rows", () => {
    expect(getIncomeCsvTemplateText("zh-Hant")).toContain("薪金");
    expect(getIncomeCsvTemplateHref("zh-Hant")).toContain(encodeURIComponent("每月薪金"));
  });
});
