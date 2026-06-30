import { useEffect, useRef, useState } from "react";
import { PlusCircle, ReceiptText } from "lucide-react";
import { createExpenseRecord } from "@/api/financeApi";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { buildExpenseRecordPayload } from "@/lib/formPayloads";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

const expenseCategories = [
  "housing",
  "food",
  "transport",
  "subscriptions",
  "insurance",
  "travel",
  "savings",
  "investment",
  "other",
];

function formatCategory(value) {
  return value.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default function ExpenseRecordForm({ currency = "HKD", isSimpleMode = false, onSaved, t }) {
  const isMountedRef = useRef(false);
  const [merchant, setMerchant] = useState("");
  const [category, setCategory] = useState("food");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayIso());
  const [paymentMethod, setPaymentMethod] = useState("");
  const [isRecurring, setIsRecurring] = useState(false);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const resetForm = () => {
    setMerchant("");
    setCategory(isSimpleMode ? "other" : "food");
    setAmount("");
    setDate(todayIso());
    setPaymentMethod("");
    setIsRecurring(false);
    setNotes("");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    const numericAmount = Number(amount);
    if (!merchant.trim() || (!isSimpleMode && !category.trim()) || !date || numericAmount <= 0) {
      setError(
        isSimpleMode
          ? `Name, date, and ${currency} amount are required.`
          : `Merchant, category, date, and ${currency} amount are required.`,
      );
      return;
    }

    setIsSubmitting(true);
    setError("");

    try {
      await createExpenseRecord(buildExpenseRecordPayload({
        merchant: merchant.trim(),
        category: isSimpleMode ? "other" : category.trim(),
        amount: numericAmount,
        date,
        paymentMethod: isSimpleMode ? "" : paymentMethod.trim(),
        isRecurring,
        notes: isSimpleMode ? "" : notes.trim(),
      }));

      if (!isMountedRef.current) return;

      resetForm();
      await onSaved?.();
    } catch (submitError) {
      if (!isMountedRef.current) return;

      setError(
        submitError instanceof Error ? submitError.message : "Unable to save expense record.",
      );
    } finally {
      if (isMountedRef.current) {
        setIsSubmitting(false);
      }
    }
  };

  return (
    <form
      className="finance-panel p-5"
      onSubmit={handleSubmit}
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="finance-card-title">{t.addExpense}</h2>
          <p className="finance-muted mt-1">
            {isSimpleMode
              ? t.simpleExpenseHelpForCurrency?.(currency) || `Simple ${currency} expense record.`
              : t.detailedTransactionHelpForCurrency?.(currency) || `Detailed ${currency} transaction.`}
          </p>
        </div>
        <ReceiptText className="h-5 w-5 shrink-0" strokeWidth={1.5} />
      </div>

      <div className="mt-5 space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="finance-label">
            {t.name}
            <input
              className="finance-input mt-1"
              onChange={(event) => setMerchant(event.target.value)}
              required
              value={merchant}
            />
          </label>
          {!isSimpleMode && (
            <label className="finance-label">
              {t.category}
              <select
                className="finance-input mt-1"
                onChange={(event) => setCategory(event.target.value)}
                required
                value={category}
              >
                {expenseCategories.map((expenseCategory) => (
                  <option key={expenseCategory} value={expenseCategory}>
                    {formatCategory(expenseCategory)}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="finance-label">
            {t.amountMoney?.(currency) || `${t.amountHkd || "Amount"} ${currency}`}
            <input
              className="finance-input mt-1"
              min="0"
              onChange={(event) => setAmount(event.target.value)}
              placeholder="0.00"
              required
              step="0.01"
              type="number"
              value={amount}
            />
          </label>
          <label className="finance-label">
            {t.date}
            <input
              className="finance-input mt-1"
              onChange={(event) => setDate(event.target.value)}
              required
              type="date"
              value={date}
            />
          </label>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {!isSimpleMode && (
            <label className="finance-label">
              {t.paymentMethod}
              <input
                className="finance-input mt-1"
                onChange={(event) => setPaymentMethod(event.target.value)}
                value={paymentMethod}
              />
            </label>
          )}
          <label className="finance-label flex items-end gap-2 pb-2">
            <Checkbox checked={isRecurring} onCheckedChange={setIsRecurring} />
            {t.recurringMonthly}
          </label>
        </div>

        {!isSimpleMode && (
          <label className="finance-label block">
            {t.note}
            <textarea
              className="finance-input mt-1 min-h-20 py-2"
              onChange={(event) => setNotes(event.target.value)}
              value={notes}
            />
          </label>
        )}

        {error && <p className="finance-error">{error}</p>}

        <Button className="w-full gap-2 sm:w-auto" disabled={isSubmitting} type="submit">
          <PlusCircle className="h-4 w-4" />
          {isSubmitting ? t.saving : t.saveExpense}
        </Button>
      </div>
    </form>
  );
}
