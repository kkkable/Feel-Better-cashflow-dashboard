import { useEffect, useMemo, useRef, useState } from "react";
import { Download, FileSpreadsheet, Upload } from "lucide-react";
import { createExpenseRecord, createIncomeRecord } from "@/api/financeApi";
import { Button } from "@/components/ui/button";
import {
  getIncomeCsvTemplateHref,
  INCOME_CSV_TEMPLATE_FILENAME,
} from "@/lib/incomeCsvTemplate";
import { parseFinanceCsv } from "@/lib/csvImport";
import { convertToHkd } from "@/lib/money";

function getErrorMessage(error, fallback) {
  return error instanceof Error ? error.message : fallback;
}

async function resolveMoney(row) {
  return {
    currency: "HKD",
    rate: 1,
    amountHkd: convertToHkd(row.amount, 1),
    rateSource: "fixed",
  };
}

export default function IncomeCsvImport({ language = "en", onImported, t }) {
  const inputRef = useRef(null);
  const isMountedRef = useRef(false);
  const activeReaderRef = useRef(null);
  const readRequestIdRef = useRef(0);
  const importRequestIdRef = useRef(0);
  const [fileName, setFileName] = useState("");
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [isReading, setIsReading] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  const validRows = preview?.validRows ?? [];
  const invalidRows = preview?.invalidRows ?? [];
  const incomeCount = validRows.filter((row) => row.type === "income").length;
  const expenseCount = validRows.filter((row) => row.type === "expense").length;
  const canImport = validRows.length > 0 && !isReading && !isImporting;

  const invalidSummary = useMemo(
    () =>
      invalidRows.slice(0, 5).map((row) => ({
        rowNumber: row.rowNumber,
        message: row.errors.join(", "),
      })),
    [invalidRows],
  );

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
      readRequestIdRef.current += 1;
      importRequestIdRef.current += 1;

      if (activeReaderRef.current?.readyState === FileReader.LOADING) {
        activeReaderRef.current.abort();
      }
    };
  }, []);

  const handleFileChange = (event) => {
    const readRequestId = readRequestIdRef.current + 1;
    readRequestIdRef.current = readRequestId;
    importRequestIdRef.current += 1;

    if (activeReaderRef.current?.readyState === FileReader.LOADING) {
      activeReaderRef.current.abort();
    }

    const file = event.target.files?.[0];
    setError("");
    setStatus("");
    setPreview(null);
    setIsImporting(false);

    if (!file) {
      setFileName("");
      return;
    }

    if (!file.name.toLowerCase().endsWith(".csv")) {
      setFileName(file.name);
      setError("Choose a .csv file.");
      return;
    }

    setFileName(file.name);
    setIsReading(true);

    const reader = new FileReader();
    activeReaderRef.current = reader;

    const isCurrentRead = () =>
      isMountedRef.current && readRequestIdRef.current === readRequestId;

    reader.onload = () => {
      if (!isCurrentRead()) return;

      try {
        setPreview(parseFinanceCsv(String(reader.result ?? "")));
      } catch (readError) {
        setError(getErrorMessage(readError, "Unable to parse CSV."));
      } finally {
        if (isCurrentRead()) {
          setIsReading(false);
          activeReaderRef.current = null;
        }
      }
    };

    reader.onerror = () => {
      if (!isCurrentRead()) return;

      setError("Unable to read CSV file.");
      setIsReading(false);
      activeReaderRef.current = null;
    };

    reader.onabort = () => {
      if (!isCurrentRead()) return;

      setIsReading(false);
      activeReaderRef.current = null;
    };

    reader.readAsText(file);
  };

  const handleConfirmImport = async () => {
    if (!canImport) return;

    const importRequestId = importRequestIdRef.current + 1;
    importRequestIdRef.current = importRequestId;
    const isCurrentImport = () =>
      isMountedRef.current && importRequestIdRef.current === importRequestId;

    setIsImporting(true);
    setError("");
    setStatus("");

    try {
      const resolvedRows = [];
      const fxErrors = [];

      for (const row of validRows) {
        try {
          const money = await resolveMoney(row);
          if (!isCurrentImport()) return;
          resolvedRows.push({ row, money });
        } catch (moneyError) {
          if (!isCurrentImport()) return;
          fxErrors.push(getErrorMessage(moneyError, "FX lookup failed"));
        }
      }

      if (fxErrors.length > 0) {
        throw new Error(`Import blocked: ${fxErrors.join("; ")}`);
      }

      for (const { row, money } of resolvedRows) {
        if (!isCurrentImport()) return;

        const commonMoney = {
          amount_original: row.amount,
          currency_original: money.currency,
          exchange_rate_to_hkd: money.rate,
          amount_hkd: money.amountHkd,
          rate_source: money.rateSource,
          date: row.date,
          is_recurring: row.isRecurring,
          notes: row.notes.trim(),
        };

        if (row.type === "income") {
          await createIncomeRecord({
            source: row.name.trim(),
            category: row.category.trim(),
            ...commonMoney,
            recurrence_frequency: row.isRecurring ? "monthly" : "none",
          });
        } else {
          await createExpenseRecord({
            merchant: row.name.trim(),
            category: row.category.trim(),
            ...commonMoney,
            payment_method: row.paymentMethod.trim(),
          });
        }

        if (!isCurrentImport()) return;
      }

      if (!isCurrentImport()) return;

      setStatus(`Imported ${incomeCount} income row${incomeCount === 1 ? "" : "s"} and ${expenseCount} expense row${expenseCount === 1 ? "" : "s"}.`);
      setPreview(null);
      setFileName("");
      if (inputRef.current) inputRef.current.value = "";
      await onImported?.();
    } catch (importError) {
      if (!isCurrentImport()) return;

      setError(getErrorMessage(importError, "Unable to import income CSV."));
    } finally {
      if (isCurrentImport()) {
        setIsImporting(false);
      }
    }
  };

  return (
    <section className="finance-panel p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="finance-card-title">{t.importRecordsCsv}</h2>
          <p className="finance-muted mt-1">
            {t.fileHelp}
          </p>
        </div>
        <FileSpreadsheet className="h-5 w-5 shrink-0" strokeWidth={1.5} />
      </div>

      <div className="mt-5 space-y-4">
        <a
          className="inline-flex min-h-11 w-full items-center justify-center gap-2 border-2 border-black bg-white px-5 py-2 text-xs font-semibold uppercase tracking-widest text-black transition-none hover:bg-black hover:text-white focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-black sm:w-auto"
          download={INCOME_CSV_TEMPLATE_FILENAME}
          href={getIncomeCsvTemplateHref(language)}
        >
          <Download className="h-4 w-4" strokeWidth={1.5} />
          {t.downloadTemplate}
        </a>

        <label className="finance-label block">
          {t.csvFile}
          <input
            ref={inputRef}
            accept=".csv,text/csv"
            className="mt-1 block w-full border-2 border-black bg-white text-sm text-black file:mr-3 file:border-0 file:bg-black file:px-3 file:py-2 file:text-xs file:font-semibold file:uppercase file:tracking-widest file:text-white hover:file:bg-white hover:file:text-black"
            onChange={handleFileChange}
            type="file"
          />
        </label>

        {fileName && (
          <p className="text-xs font-semibold uppercase tracking-widest text-neutral-600">
            {t.selected}: <span className="text-black">{fileName}</span>
          </p>
        )}

        {preview && (
          <div className="border border-black bg-neutral-100 p-3 text-sm">
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-black">
              <span>
                Valid: <strong>{validRows.length}</strong>
              </span>
              <span>
                {t.income}: <strong>{incomeCount}</strong>
              </span>
              <span>
                {t.expenses}: <strong>{expenseCount}</strong>
              </span>
              <span>
                Invalid: <strong>{invalidRows.length}</strong>
              </span>
            </div>

            {invalidSummary.length > 0 && (
              <ul className="mt-3 space-y-1 text-xs font-semibold uppercase tracking-widest text-black">
                {invalidSummary.map((row) => (
                  <li key={row.rowNumber}>
                    Row {row.rowNumber}: {row.message}
                  </li>
                ))}
                {invalidRows.length > invalidSummary.length && (
                  <li>{invalidRows.length - invalidSummary.length} more invalid rows.</li>
                )}
              </ul>
            )}
          </div>
        )}

        {error && <p className="finance-error">{error}</p>}
        {status && <p className="finance-status">{status}</p>}

        <Button
          className="w-full gap-2 sm:w-auto"
          disabled={!canImport}
          onClick={handleConfirmImport}
          type="button"
        >
          <Upload className="h-4 w-4" />
          {isImporting ? t.importing : t.confirmImport}
        </Button>
      </div>
    </section>
  );
}
