import { useEffect, useState } from "react";
import { HeartHandshake, Sparkles } from "lucide-react";
import { getFeelBetterReview } from "@/api/financeApi";
import { Button } from "@/components/ui/button";
import { formatFeelBetterDefaultInput } from "@/lib/feelBetterDefaults";
import { CURRENCY_SYMBOLS, formatMoney, normalizeCurrency } from "@/lib/money";

function parseMoney(value) {
  const normalizedValue = String(value).replace(/,/g, "").trim();
  return normalizedValue === "" ? Number.NaN : Number(normalizedValue);
}

function formatMetricMoney(amount, currency) {
  const normalizedCurrency = normalizeCurrency(currency);
  const absoluteAmount = Math.abs(amount);
  const prefix = CURRENCY_SYMBOLS[normalizedCurrency] || "$";

  if (absoluteAmount >= 1000000000) {
    return `${amount < 0 ? "-" : ""}${prefix}${(absoluteAmount / 1000000000).toFixed(1)}B`;
  }

  if (absoluteAmount >= 1000000) {
    return `${amount < 0 ? "-" : ""}${prefix}${(absoluteAmount / 1000000).toFixed(1)}M`;
  }

  if (absoluteAmount >= 10000) {
    return `${amount < 0 ? "-" : ""}${prefix}${Math.round(absoluteAmount / 1000)}K`;
  }

  return formatMoney(amount, currency);
}

function Metric({ label, value }) {
  return (
    <article className="min-w-0 border-2 border-black p-4">
      <p className="finance-label">{label}</p>
      <p className="mt-2 break-words text-lg font-semibold leading-tight text-black sm:text-xl xl:text-2xl">
        {value}
      </p>
    </article>
  );
}

export default function FeelBetterMode({ currency = "HKD", defaultExpenseHkd = 0, defaultIncomeHkd = 0, language, t }) {
  const [income, setIncome] = useState(() => formatFeelBetterDefaultInput(defaultIncomeHkd));
  const [expense, setExpense] = useState(() => formatFeelBetterDefaultInput(defaultExpenseHkd));
  const [hasEditedIncome, setHasEditedIncome] = useState(false);
  const [hasEditedExpense, setHasEditedExpense] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (hasEditedIncome) return;
    setIncome(formatFeelBetterDefaultInput(defaultIncomeHkd));
  }, [defaultIncomeHkd, hasEditedIncome]);

  useEffect(() => {
    if (hasEditedExpense) return;
    setExpense(formatFeelBetterDefaultInput(defaultExpenseHkd));
  }, [defaultExpenseHkd, hasEditedExpense]);

  async function handleSubmit(event) {
    event.preventDefault();

    const monthlyIncomeExpected = parseMoney(income);
    const monthlyExpenseExpected = parseMoney(expense);

    if (
      !Number.isFinite(monthlyIncomeExpected) ||
      !Number.isFinite(monthlyExpenseExpected) ||
      monthlyIncomeExpected < 0 ||
      monthlyExpenseExpected < 0
    ) {
      setError(t.feelBetterInputError);
      setResult(null);
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const review = await getFeelBetterReview({
        currency,
        monthlyIncomeExpected,
        monthlyExpenseExpected,
        language,
      });
      setResult(review);
    } catch (reviewError) {
      setError(reviewError instanceof Error ? reviewError.message : t.feelBetterLoadError);
      setResult(null);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <section className="space-y-6">
      <div className="grid gap-3 border-b-4 border-black pb-5 lg:grid-cols-[minmax(0,0.35fr)_minmax(0,0.65fr)]">
        <div>
          <p className="finance-label">{t.feelBetter}</p>
          <h2 className="mt-2 text-4xl font-semibold leading-none">{t.feelBetterTitle}</h2>
        </div>
        {t.feelBetterIntro && <p className="text-lg leading-7 text-neutral-700">{t.feelBetterIntro}</p>}
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,0.42fr)_minmax(0,0.58fr)]">
        <form className="finance-panel p-5" data-tutorial-target="feel-better-input" onSubmit={handleSubmit}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="finance-card-title">{t.moneyMood}</h3>
              <p className="finance-muted mt-1">{t.currencyOnly?.(currency) || `${currency} only.`}</p>
            </div>
            <HeartHandshake className="h-5 w-5 shrink-0" strokeWidth={1.5} />
          </div>

          <div className="mt-5 space-y-4">
            <label className="finance-label block">
              {t.monthlyIncomeExpected}
              <input
                className="finance-input mt-1"
                min="0"
                onChange={(event) => {
                  setHasEditedIncome(true);
                  setIncome(event.target.value);
                }}
                placeholder="30000"
                step="0.01"
                type="number"
                value={income}
              />
            </label>
            <label className="finance-label block">
              {t.monthlyExpenseExpected}
              <input
                className="finance-input mt-1"
                min="0"
                onChange={(event) => {
                  setHasEditedExpense(true);
                  setExpense(event.target.value);
                }}
                placeholder="22000"
                step="0.01"
                type="number"
                value={expense}
              />
            </label>

            {error && <p className="finance-error">{error}</p>}

            <Button className="w-full gap-2 sm:w-auto" disabled={isLoading} type="submit">
              <Sparkles className="h-4 w-4" strokeWidth={1.5} />
              {isLoading ? t.reviewing : t.reviewMyMoney}
            </Button>
          </div>
        </form>

        <section className="finance-panel p-5" data-tutorial-target="feel-better-response">
          {result ? (
            <div className="space-y-5">
              <div>
                <p className="finance-label">{t.moneyMood}</p>
                <p className="mt-2 text-4xl font-semibold leading-none">
                  {result.title || result.mood_label}
                </p>
                <p className="finance-muted mt-2">{result.mood_label}</p>
              </div>
              <p className="border-l-4 border-black pl-4 text-xl leading-8 text-black">
                {result.comment}
              </p>
              <div className="grid gap-3 sm:grid-cols-3">
                <Metric label={t.leftover} value={formatMetricMoney(result.leftover_hkd, currency)} />
                <Metric label={t.savingsRate} value={`${result.savings_rate_percent}%`} />
                <Metric
                  label={t.aiSource}
                  value={result.source === "huggingface" ? t.huggingFace : t.localRules}
                />
              </div>
              <div>
                <p className="finance-label">{t.suggestions}</p>
                <div className="mt-3 grid gap-2">
                  {(result.suggestions || []).map((suggestion) => (
                    <p className="border border-black px-3 py-2 text-sm font-semibold text-black" key={suggestion}>
                      {suggestion}
                    </p>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex min-h-72 items-center justify-center border-2 border-dashed border-black p-6 text-center">
              <div>
                <Sparkles className="mx-auto h-6 w-6" strokeWidth={1.5} />
                <p className="finance-muted mt-3">{t.moneyMood}</p>
              </div>
            </div>
          )}
        </section>
      </div>
    </section>
  );
}
