import { describe, expect, test } from "vitest";
import { parseQuickCaptureText, shouldUseAiFallback } from "../../base44/functions/_shared/quickCaptureParser";

const fixedNow = new Date("2026-06-27T12:00:00.000Z");

describe("parseQuickCaptureText", () => {
  test("parses multiple simple expense pairs from one message", () => {
    const drafts = parseQuickCaptureText("lunch 58 mtr 12 coffee 42", fixedNow);

    expect(drafts).toMatchObject([
      { record_type: "expense", name: "lunch", category: "food", amount_hkd: 58, date: "2026-06-27" },
      { record_type: "expense", name: "mtr", category: "transport", amount_hkd: 12, date: "2026-06-27" },
      { record_type: "expense", name: "coffee", category: "food", amount_hkd: 42, date: "2026-06-27" },
    ]);
  });

  test("detects income and recurring monthly entries", () => {
    const drafts = parseQuickCaptureText("salary 30000 monthly", fixedNow);

    expect(drafts).toMatchObject([
      { record_type: "income", name: "salary", category: "salary", amount_hkd: 30000, is_recurring: true },
    ]);
  });

  test("marks unclear messages as unknown drafts", () => {
    const drafts = parseQuickCaptureText("today was expensive", fixedNow);

    expect(drafts).toMatchObject([
      { record_type: "unknown", name: "Needs review", amount_hkd: 0, confidence: 0.2 },
    ]);
  });

  test("parses sentence style expenses with currency symbols", () => {
    const drafts = parseQuickCaptureText("i buy a small coffee with $50", fixedNow);

    expect(drafts).toMatchObject([
      { record_type: "expense", name: "small coffee", category: "food", amount_hkd: 50, confidence: 0.65 },
    ]);
  });

  test("routes simple short record messages to AI fallback", () => {
    const text = "lunch 58 mtr 12 coffee 42";
    const drafts = parseQuickCaptureText(text, fixedNow);

    expect(shouldUseAiFallback(text, drafts)).toBe(true);
  });

  test("routes newline-separated basic record messages to AI fallback", () => {
    const text = "lunch 58\nmtr 12 coffee 42";
    const drafts = parseQuickCaptureText(text, fixedNow);

    expect(shouldUseAiFallback(text, drafts)).toBe(true);
  });

  test("routes simple monthly record messages to AI fallback", () => {
    const text = "rent 15000 monthly";
    const drafts = parseQuickCaptureText(text, fixedNow);

    expect(shouldUseAiFallback(text, drafts)).toBe(true);
  });

  test("routes natural language mixed money messages to AI fallback", () => {
    const text = "my mom sent me $300 as red packet i buy a milktea with 20 dollars";
    const drafts = parseQuickCaptureText(text, fixedNow);

    expect(shouldUseAiFallback(text, drafts)).toBe(true);
  });

  test("routes rebate sentences to AI fallback even when local parser finds an amount", () => {
    const text = "I get 450 rebate from credit card";
    const drafts = parseQuickCaptureText(text, fixedNow);

    expect(shouldUseAiFallback(text, drafts)).toBe(true);
  });

  test("routes rebate descriptions to AI fallback when they look like simple pairs", () => {
    const text = "credit card rebate 450";
    const drafts = parseQuickCaptureText(text, fixedNow);

    expect(shouldUseAiFallback(text, drafts)).toBe(true);
  });

  test("classifies family give-me wording as income in local fallback", () => {
    const drafts = parseQuickCaptureText("mom give me 300", fixedNow);

    expect(drafts).toMatchObject([
      { record_type: "income", name: "mom give me", amount_hkd: 300 },
    ]);
  });

  test("classifies part time job wording as income in local fallback", () => {
    const drafts = parseQuickCaptureText("part time job 200", fixedNow);

    expect(drafts).toMatchObject([
      { record_type: "income", name: "part time job", amount_hkd: 200 },
    ]);
  });

  test("routes received red packet messages to AI fallback even when local parser finds an amount", () => {
    const text = "receive red packet 300 from family";
    const drafts = parseQuickCaptureText(text, fixedNow);

    expect(shouldUseAiFallback(text, drafts)).toBe(true);
  });

  test("treats paid-to-family wording as expense if AI fallback is unavailable", () => {
    const drafts = parseQuickCaptureText("paid my bro 100", fixedNow);

    expect(drafts).toMatchObject([
      { record_type: "expense", name: "paid my bro", amount_hkd: 100 },
    ]);
    expect(shouldUseAiFallback("paid my bro 100", drafts)).toBe(true);
  });

  test("classifies youtube premium as a subscription in local fallback", () => {
    const drafts = parseQuickCaptureText("youtube premium 50 monthly", fixedNow);

    expect(drafts).toMatchObject([
      { record_type: "expense", name: "youtube premium", category: "subscriptions", amount_hkd: 50, is_recurring: true },
    ]);
  });

  test("routes typo-heavy mixed monthly messages to AI fallback", () => {
    const text = "receice monthly income 30000 monthly subscriptio youtibe premium 50 paid my bro 100";
    const drafts = parseQuickCaptureText(text, fixedNow);

    expect(shouldUseAiFallback(text, drafts)).toBe(true);
  });

  test("keeps monthly recurring scoped to newline-separated records", () => {
    const drafts = parseQuickCaptureText("monthly income 500\ndinner 80", fixedNow);

    expect(drafts).toMatchObject([
      { raw_text: "monthly income 500", record_type: "income", name: "income", amount_hkd: 500, is_recurring: true },
      { raw_text: "dinner 80", record_type: "expense", name: "dinner", amount_hkd: 80, is_recurring: false },
    ]);
  });

  test("keeps monthly recurring scoped to comma-separated records", () => {
    const drafts = parseQuickCaptureText("income 800 monthly, lunch 50", fixedNow);

    expect(drafts).toMatchObject([
      { raw_text: "income 800 monthly", record_type: "income", name: "income", amount_hkd: 800, is_recurring: true },
      { raw_text: "lunch 50", record_type: "expense", name: "lunch", amount_hkd: 50, is_recurring: false },
    ]);
  });
});
