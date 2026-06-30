import { useEffect, useRef, useState } from "react";
import { PlusCircle } from "lucide-react";
import { createIncomeRecord } from "@/api/financeApi";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { buildIncomePayload } from "@/lib/formPayloads";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

const incomeCategories = [
  "salary",
  "freelance",
  "investment",
  "rental",
  "bonus",
  "other",
];

function formatCategory(value) {
  return value.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default function IncomeForm({ currency = "HKD", isSimpleMode = false, onSaved, t }) {
  const isMountedRef = useRef(false);
  const [source, setSource] = useState("");
  const [category, setCategory] = useState("salary");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayIso());
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
    setSource("");
    setCategory("salary");
    setAmount("");
    setDate(todayIso());
    setIsRecurring(false);
    setNotes("");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    const numericAmount = Number(amount);
    if (!source.trim() || !date || numericAmount <= 0 || (!isSimpleMode && !category.trim())) {
      setError(`Source, date, and ${currency} amount are required.`);
      return;
    }

    setIsSubmitting(true);
    setError("");

    try {
      await createIncomeRecord(buildIncomePayload({
        source: source.trim(),
        category: isSimpleMode ? "salary" : category.trim(),
        amount: numericAmount,
        date,
        isRecurring,
        notes: isSimpleMode ? "" : notes.trim(),
      }));

      if (!isMountedRef.current) return;

      resetForm();
      await onSaved?.();
    } catch (submitError) {
      if (!isMountedRef.current) return;

      setError(
        submitError instanceof Error ? submitError.message : "Unable to save income record.",
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
          <h2 className="finance-card-title">{t.addIncome}</h2>
          <p className="finance-muted mt-1">{t.currencyOnly?.(currency) || `${currency} only.`}</p>
        </div>
        <PlusCircle className="h-5 w-5 shrink-0" strokeWidth={1.5} />
      </div>

      <div className="mt-5 space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="finance-label">
            {t.source}
            <input
              className="finance-input mt-1"
              onChange={(event) => setSource(event.target.value)}
              required
              value={source}
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
                {incomeCategories.map((incomeCategory) => (
                  <option key={incomeCategory} value={incomeCategory}>
                    {formatCategory(incomeCategory)}
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

        <label className="finance-label flex items-center gap-2">
          <Checkbox checked={isRecurring} onCheckedChange={setIsRecurring} />
          {t.recurringMonthlyIncome}
        </label>

        {error && <p className="finance-error">{error}</p>}

        <Button className="w-full gap-2 sm:w-auto" disabled={isSubmitting} type="submit">
          <PlusCircle className="h-4 w-4" />
          {isSubmitting ? t.saving : t.saveIncome}
        </Button>
      </div>
    </form>
  );
}
