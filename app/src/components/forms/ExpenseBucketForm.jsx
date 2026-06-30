import { useEffect, useRef, useState } from "react";
import { Archive, PlusCircle } from "lucide-react";
import { createExpenseBucket } from "@/api/financeApi";
import { Button } from "@/components/ui/button";
import { buildExpenseBucketPayload } from "@/lib/formPayloads";

export default function ExpenseBucketForm({ currency = "HKD", onSaved, t }) {
  const isMountedRef = useRef(false);
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const resetForm = () => {
    setName("");
    setAmount("");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    const numericAmount = Number(amount);
    if (!name.trim() || numericAmount <= 0) {
      setError(`Name and planned ${currency} amount are required.`);
      return;
    }

    setIsSubmitting(true);
    setError("");

    try {
      await createExpenseBucket(buildExpenseBucketPayload({
        name: name.trim(),
        amount: numericAmount,
      }));

      if (!isMountedRef.current) return;

      resetForm();
      await onSaved?.();
    } catch (submitError) {
      if (!isMountedRef.current) return;

      setError(
        submitError instanceof Error ? submitError.message : "Unable to save expense bucket.",
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
          <h2 className="finance-card-title">{t.addExpenseBucket}</h2>
          <p className="finance-muted mt-1">{t.simplePlanHelpForCurrency?.(currency) || `Simple monthly ${currency} plan.`}</p>
        </div>
        <Archive className="h-5 w-5 shrink-0" strokeWidth={1.5} />
      </div>

      <div className="mt-5 space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="finance-label">
            {t.name}
            <input
              className="finance-input mt-1"
              onChange={(event) => setName(event.target.value)}
              required
              value={name}
            />
          </label>
          <label className="finance-label">
            {t.plannedAmountMoney?.(currency) || `Planned amount ${currency}`}
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
        </div>

        {error && <p className="finance-error">{error}</p>}

        <Button className="w-full gap-2 sm:w-auto" disabled={isSubmitting} type="submit">
          <PlusCircle className="h-4 w-4" />
          {isSubmitting ? t.saving : t.saveBucket}
        </Button>
      </div>
    </form>
  );
}
