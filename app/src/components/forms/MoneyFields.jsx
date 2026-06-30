import { useEffect, useId, useMemo, useRef, useState } from "react";
import { getExchangeRate } from "@/api/financeApi";
import { convertToHkd, normalizeCurrency, SUPPORTED_CURRENCIES } from "@/lib/money";

function isPositiveNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0;
}

export default function MoneyFields({
  amount,
  currency,
  date,
  onAmountChange,
  onCurrencyChange,
  onDateChange,
  onMoneyChange,
  amountLabel = "Amount",
  dateLabel = "Date",
}) {
  const [rateInput, setRateInput] = useState("1");
  const [rateCurrency, setRateCurrency] = useState("HKD");
  const [rateSource, setRateSource] = useState("fixed");
  const [lookupState, setLookupState] = useState("idle");
  const datalistId = useId();
  const isMountedRef = useRef(false);
  const hasManualOverrideRef = useRef(false);
  const previousCurrencyRef = useRef(null);
  const requestIdRef = useRef(0);
  const manualEditRef = useRef(0);

  const normalizedCurrency = useMemo(
    () => normalizeCurrency(currency || "HKD"),
    [currency],
  );
  const numericAmount = Number(amount);
  const numericRate = Number(rateInput);
  const hasValidAmount = isPositiveNumber(amount);
  const hasValidRate =
    rateCurrency === normalizedCurrency && Number.isFinite(numericRate) && numericRate > 0;
  const amountHkd =
    hasValidAmount && hasValidRate ? convertToHkd(numericAmount, numericRate) : 0;

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
      requestIdRef.current += 1;
    };
  }, []);

  useEffect(() => {
    if (previousCurrencyRef.current === normalizedCurrency) return;

    previousCurrencyRef.current = normalizedCurrency;
    requestIdRef.current += 1;
    hasManualOverrideRef.current = false;

    if (normalizedCurrency === "HKD") {
      setRateInput("1");
      setRateCurrency("HKD");
      setRateSource("fixed");
    } else {
      setRateInput("");
      setRateCurrency(normalizedCurrency);
      setRateSource("manual");
    }

    setLookupState("idle");
  }, [normalizedCurrency]);

  useEffect(() => {
    onMoneyChange?.({
      currency: normalizedCurrency,
      rate: hasValidRate ? numericRate : 0,
      amountHkd,
      rateSource,
    });
  }, [amountHkd, hasValidRate, normalizedCurrency, numericRate, onMoneyChange, rateSource]);

  useEffect(() => {
    if (
      normalizedCurrency === "HKD" ||
      !date ||
      !hasValidAmount ||
      hasManualOverrideRef.current
    ) {
      return;
    }

    const requestId = requestIdRef.current + 1;
    const manualEditAtStart = manualEditRef.current;
    requestIdRef.current = requestId;
    setLookupState("loading");

    getExchangeRate(normalizedCurrency, date)
      .then((result) => {
        const fetchedRate = Number(result?.rate);
        if (
          !isMountedRef.current ||
          requestIdRef.current !== requestId ||
          hasManualOverrideRef.current ||
          manualEditRef.current !== manualEditAtStart ||
          !Number.isFinite(fetchedRate) ||
          fetchedRate <= 0
        ) {
          return;
        }

        setRateInput(String(fetchedRate));
        setRateCurrency(normalizedCurrency);
        setRateSource(
          typeof result?.provider === "string" && result.provider.trim()
            ? result.provider.trim()
            : "backend",
        );
        setLookupState("success");
      })
      .catch(() => {
        if (!isMountedRef.current || requestIdRef.current !== requestId) return;

        setRateSource("manual");
        setLookupState("failed");
      });
  }, [date, hasValidAmount, normalizedCurrency]);

  const handleCurrencyBlur = () => {
    onCurrencyChange(normalizedCurrency || "HKD");
  };

  const handleRateChange = (event) => {
    manualEditRef.current += 1;
    hasManualOverrideRef.current = normalizedCurrency !== "HKD";
    setRateInput(event.target.value);
    setRateCurrency(normalizedCurrency);
    setRateSource(normalizedCurrency === "HKD" ? "fixed" : "manual");
    setLookupState("idle");
  };

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_9rem]">
        <label className="block text-sm font-medium text-slate-700">
          {amountLabel}
          <input
            className="mt-1 flex h-9 w-full rounded-md border border-slate-200 bg-white px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-400"
            min="0"
            onChange={(event) => onAmountChange(event.target.value)}
            placeholder="0.00"
            required
            step="0.01"
            type="number"
            value={amount}
          />
        </label>

        <label className="block text-sm font-medium text-slate-700">
          Currency
          <input
            className="mt-1 flex h-9 w-full rounded-md border border-slate-200 bg-white px-3 py-1 text-sm uppercase shadow-sm transition-colors placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-400"
            list={datalistId}
            maxLength={3}
            onBlur={handleCurrencyBlur}
            onChange={(event) => onCurrencyChange(event.target.value.toUpperCase())}
            required
            value={currency}
          />
          <datalist id={datalistId}>
            {SUPPORTED_CURRENCIES.map((code) => (
              <option key={code} value={code} />
            ))}
          </datalist>
        </label>
      </div>

      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <label className="block text-sm font-medium text-slate-700">
          {dateLabel}
          <input
            className="mt-1 flex h-9 w-full rounded-md border border-slate-200 bg-white px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-400"
            onChange={(event) => onDateChange(event.target.value)}
            required
            type="date"
            value={date}
          />
        </label>

        <label className="block text-sm font-medium text-slate-700">
          FX to HKD
          <input
            className="mt-1 flex h-9 w-full rounded-md border border-slate-200 bg-white px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-400"
            min="0"
            onChange={handleRateChange}
            required
            step="0.000001"
            type="number"
            value={rateInput}
          />
        </label>
      </div>

      <div className="flex flex-col gap-1 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
        <span>
          HKD amount:{" "}
          <strong className="font-semibold text-slate-700">
            {amountHkd.toLocaleString("en-HK", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </strong>
        </span>
        <span>
          {lookupState === "loading"
            ? "Fetching FX rate"
            : lookupState === "failed"
              ? "FX lookup failed; manual rate enabled"
              : rateSource === "manual"
                ? "Manual FX rate"
                : normalizedCurrency === "HKD"
                  ? "HKD base rate"
                  : "FX rate ready"}
        </span>
      </div>
    </div>
  );
}
