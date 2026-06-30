import { useMemo, useState } from "react";
import { BarChart3, Check, ListChecks } from "lucide-react";
import { updateUserSettings } from "@/api/financeApi";
import { Button } from "@/components/ui/button";
import { normalizeCurrency, SUPPORTED_CURRENCIES } from "@/lib/money";

const modeOptions = [
  {
    value: "simple",
    title: "Simple",
    description: "Track spending in broad buckets and keep projections steady.",
    Icon: ListChecks,
  },
  {
    value: "detailed",
    title: "Detailed",
    description: "Record actual spending and include it in future projections.",
    Icon: BarChart3,
  },
];

export default function Onboarding({ initialSettings, onComplete }) {
  const initialMode = useMemo(() => {
    return ["simple", "detailed"].includes(initialSettings?.expense_mode)
      ? initialSettings.expense_mode
      : "simple";
  }, [initialSettings?.expense_mode]);

  const [expenseMode, setExpenseMode] = useState(initialMode);
  const [baseCurrency, setBaseCurrency] = useState(() =>
    normalizeCurrency(initialSettings?.base_currency || "HKD"),
  );
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!initialSettings?.id) {
      setSaveError("Settings record is missing. Reload the app and try again.");
      return;
    }

    setIsSaving(true);
    setSaveError("");

    try {
      const updatedSettings = await updateUserSettings(initialSettings.id, {
        base_currency: baseCurrency,
        expense_mode: expenseMode,
        projection_months: 6,
        include_actual_spending_in_projection: expenseMode === "detailed",
        onboarding_completed: true,
      });

      onComplete(updatedSettings);
    } catch (error) {
      setSaveError(
        error instanceof Error
          ? error.message
          : "Unable to save your finance settings.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <main className="finance-page px-6 py-10">
      <div className="mx-auto flex min-h-[80vh] max-w-3xl items-center">
        <form className="w-full" onSubmit={handleSubmit}>
          <div className="mb-8 border-b-4 border-black pb-6">
            <p className="finance-label">
              Personal finance setup
            </p>
            <h1 className="mt-2 text-5xl font-semibold leading-none tracking-normal sm:text-6xl">
              Choose how you want to track expenses
            </h1>
            <p className="mt-4 max-w-2xl text-lg leading-7 text-neutral-700">
              This sets the dashboard mode, money currency, and six-month projection defaults.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {modeOptions.map(({ value, title, description, Icon }) => {
              const isSelected = expenseMode === value;

              return (
                <button
                  aria-pressed={isSelected}
                  className={`border-2 border-black p-5 text-left transition-none focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-black ${
                    isSelected
                      ? "bg-black text-white"
                      : "bg-white text-black hover:bg-black hover:text-white"
                  }`}
                  key={value}
                  onClick={() => setExpenseMode(value)}
                  type="button"
                >
                  <div className="flex items-start justify-between gap-4">
                    <span className="border border-current p-2">
                      <Icon className="h-5 w-5" strokeWidth={1.5} />
                    </span>
                    <span className={`border border-current p-1 ${isSelected ? "opacity-100" : "opacity-0"}`}>
                      <Check className="h-4 w-4" strokeWidth={2} />
                    </span>
                  </div>
                  <h2 className="mt-5 text-2xl font-semibold">{title}</h2>
                  <p className="mt-2 text-sm leading-6 opacity-75">
                    {description}
                  </p>
                </button>
              );
            })}
          </div>

          <section className="mt-5 border-2 border-black p-5">
            <label className="finance-label block" htmlFor="onboarding-currency">
              Currency
            </label>
            <p className="finance-muted mt-1">
              Amounts will be shown and reviewed as this currency. No automatic FX conversion is applied.
            </p>
            <select
              className="finance-input mt-3"
              id="onboarding-currency"
              onChange={(event) => setBaseCurrency(normalizeCurrency(event.target.value))}
              value={baseCurrency}
            >
              {SUPPORTED_CURRENCIES.map((currency) => (
                <option key={currency} value={currency}>
                  {currency}
                </option>
              ))}
            </select>
          </section>

          {saveError && (
            <p className="finance-error mt-5">
              {saveError}
            </p>
          )}

          <div className="mt-8 flex items-center justify-end">
            <Button className="h-10 px-5" disabled={isSaving} type="submit">
              {isSaving ? "Saving..." : "Continue"}
            </Button>
          </div>
        </form>
      </div>
    </main>
  );
}
