import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, LogOut, RefreshCcw } from "lucide-react";
import {
  listExpenseBuckets,
  listExpenseRecords,
  listIncomeRecords,
  updateUserSettings,
} from "@/api/financeApi";
import MetricCards from "@/components/dashboard/MetricCards";
import ManageRecords from "@/components/dashboard/ManageRecords";
import ModeSwitch from "@/components/dashboard/ModeSwitch";
import ProjectionChart from "@/components/dashboard/ProjectionChart";
import RecordsPanel from "@/components/dashboard/RecordsPanel";
import ExpenseBucketForm from "@/components/forms/ExpenseBucketForm";
import ExpenseRecordForm from "@/components/forms/ExpenseRecordForm";
import IncomeCsvImport from "@/components/forms/IncomeCsvImport";
import IncomeForm from "@/components/forms/IncomeForm";
import { Button } from "@/components/ui/button";
import { getTranslations, LANGUAGE_OPTIONS, normalizeLanguage } from "@/lib/i18n";
import { buildMonthlyProjection } from "@/lib/projections";

function getCurrentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function getErrorMessage(error, fallback) {
  return error instanceof Error ? error.message : fallback;
}

function NavButton({ active, children, onClick }) {
  return (
    <button
      className={`w-full border-2 border-black px-4 py-3 text-left text-xs font-semibold uppercase tracking-widest transition-none focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-black ${
        active ? "bg-black text-white" : "bg-white text-black hover:bg-black hover:text-white"
      }`}
      onClick={onClick}
      type="button"
    >
      {children}
    </button>
  );
}

function sumBy(records, selector) {
  return (Array.isArray(records) ? records : []).reduce(
    (sum, record) => sum + Number(selector(record) || 0),
    0,
  );
}

export default function Dashboard({ accountName, initialSettings, onLogout }) {
  const isMountedRef = useRef(false);
  const [settings, setSettings] = useState(initialSettings);
  const [incomeRecords, setIncomeRecords] = useState([]);
  const [expenseBuckets, setExpenseBuckets] = useState([]);
  const [expenseRecords, setExpenseRecords] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [isSavingMode, setIsSavingMode] = useState(false);
  const [modeError, setModeError] = useState("");
  const [activeSection, setActiveSection] = useState("dashboard");
  const [recordSection, setRecordSection] = useState("quick-add");

  const expenseMode = settings?.expense_mode === "detailed" ? "detailed" : "simple";
  const projectionMonths = settings?.projection_months || 6;
  const language = normalizeLanguage(settings?.language);
  const t = getTranslations(language);
  const startMonth = useMemo(() => getCurrentMonth(), []);

  const loadDashboardData = useCallback(async () => {
    if (!isMountedRef.current) return;

    setIsLoading(true);
    setLoadError("");

    try {
      const [income, buckets, expenses] = await Promise.all([
        listIncomeRecords(),
        listExpenseBuckets(),
        listExpenseRecords(),
      ]);

      if (!isMountedRef.current) return;

      setIncomeRecords(Array.isArray(income) ? income : []);
      setExpenseBuckets(Array.isArray(buckets) ? buckets : []);
      setExpenseRecords(Array.isArray(expenses) ? expenses : []);
    } catch (error) {
      if (!isMountedRef.current) return;

      setLoadError(getErrorMessage(error, "Unable to load dashboard data."));
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    loadDashboardData();

    return () => {
      isMountedRef.current = false;
    };
  }, [loadDashboardData]);

  const projections = useMemo(() => {
    try {
      return buildMonthlyProjection({
        months: projectionMonths,
        startMonth,
        includeActualSpending:
          settings?.include_actual_spending_in_projection ?? expenseMode === "detailed",
        incomeRecords,
        expenseBuckets,
        expenseRecords,
      });
    } catch {
      return [];
    }
  }, [
    expenseBuckets,
    expenseMode,
    expenseRecords,
    incomeRecords,
    projectionMonths,
    settings?.include_actual_spending_in_projection,
    startMonth,
  ]);

  const currentProjection = projections[0];
  const totalIncomeHkd = useMemo(
    () => sumBy(incomeRecords, (record) => record.amount_hkd),
    [incomeRecords],
  );
  const totalExpenseHkd = useMemo(
    () =>
      expenseMode === "detailed"
        ? sumBy(expenseRecords, (record) => record.amount_hkd)
        : sumBy(expenseBuckets, (record) => record.planned_monthly_amount_hkd),
    [expenseBuckets, expenseMode, expenseRecords],
  );

  const handleModeChange = async (mode) => {
    if (mode === expenseMode || isSavingMode) return;

    if (!settings?.id) {
      setModeError("Settings record is missing. Reload the app and try again.");
      return;
    }

    const patch = {
      expense_mode: mode,
      include_actual_spending_in_projection: mode === "detailed",
    };

    setIsSavingMode(true);
    setModeError("");

    try {
      const updatedSettings = await updateUserSettings(settings.id, patch);
      if (!isMountedRef.current) return;

      setSettings((previousSettings) => ({
        ...previousSettings,
        ...patch,
        ...(updatedSettings || {}),
      }));
    } catch (error) {
      if (!isMountedRef.current) return;

      setModeError(getErrorMessage(error, "Unable to update dashboard mode."));
    } finally {
      if (isMountedRef.current) {
        setIsSavingMode(false);
      }
    }
  };

  const handleLanguageChange = async (nextLanguage) => {
    if (nextLanguage === language || !settings?.id) return;

    const patch = { language: nextLanguage };
    setModeError("");
    try {
      const updatedSettings = await updateUserSettings(settings.id, patch);
      if (!isMountedRef.current) return;
      setSettings((previousSettings) => ({
        ...previousSettings,
        ...patch,
        ...(updatedSettings || {}),
      }));
    } catch (error) {
      if (!isMountedRef.current) return;
      setModeError(getErrorMessage(error, "Unable to update language."));
    }
  };

  return (
    <main className="finance-page">
      <div className="finance-shell">
        <header className="border-b-4 border-black pb-6">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="finance-label">
              {language === "zh-Hant" ? "個人理財" : "Personal finance"}
            </p>
            <h1 className="mt-2 max-w-4xl text-5xl font-semibold leading-none tracking-normal sm:text-6xl lg:text-7xl">
              {language === "zh-Hant" ? "現金流總覽" : "Cashflow dashboard"}
            </h1>
            <p className="mt-4 max-w-2xl text-lg leading-7 text-neutral-700">
              {language === "zh-Hant"
                ? `${projectionMonths} 個月港幣預測，由 ${startMonth} 開始。`
                : `${projectionMonths}-month HKD projection starting ${startMonth}.`}
            </p>
          </div>

          </div>
        </header>

        {modeError && (
          <p className="finance-error mt-4">
            {modeError}
          </p>
        )}

        {isLoading ? (
          <section className="flex min-h-[45vh] items-center justify-center">
            <div className="text-center">
              <div className="mx-auto mb-4 h-8 w-8 animate-spin border-2 border-black border-t-white" />
              <p className="finance-muted">Loading dashboard data...</p>
            </div>
          </section>
        ) : loadError ? (
          <section className="finance-panel mt-8 p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex gap-3">
                <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" strokeWidth={1.5} />
                <div>
                  <h2 className="finance-card-title">
                    Dashboard data could not load
                  </h2>
                  <p className="finance-muted mt-2">{loadError}</p>
                </div>
              </div>
              <Button className="gap-2" onClick={loadDashboardData} type="button">
                <RefreshCcw className="h-4 w-4" />
                Retry
              </Button>
            </div>
          </section>
        ) : (
          <div className="mt-8 grid gap-8 lg:grid-cols-[14rem_minmax(0,1fr)]">
            <aside className="space-y-3 lg:sticky lg:top-6 lg:self-start">
              <NavButton active={activeSection === "dashboard"} onClick={() => setActiveSection("dashboard")}>
                {t.dashboard}
              </NavButton>
              <NavButton active={activeSection === "record"} onClick={() => setActiveSection("record")}>
                {t.navRecord}
              </NavButton>
              <NavButton active={activeSection === "account"} onClick={() => setActiveSection("account")}>
                {t.account}
              </NavButton>
            </aside>

            <div className="min-w-0">
              {activeSection === "dashboard" && (
                <div className="space-y-8">
                  <MetricCards projection={currentProjection} t={t} />

                  <section className="grid gap-4 md:grid-cols-4">
                    <article className="finance-panel p-5">
                      <p className="finance-label">{t.incomeRecords}</p>
                      <p className="mt-3 text-3xl font-semibold">{incomeRecords.length}</p>
                    </article>
                    <article className="finance-panel p-5">
                      <p className="finance-label">{t.expenseRecords}</p>
                      <p className="mt-3 text-3xl font-semibold">
                        {expenseMode === "detailed" ? expenseRecords.length : expenseBuckets.length}
                      </p>
                    </article>
                    <article className="finance-panel p-5">
                      <p className="finance-label">{t.totalIncomeEntered}</p>
                      <p className="mt-3 text-2xl font-semibold">
                        {totalIncomeHkd.toLocaleString("en-HK", { style: "currency", currency: "HKD" })}
                      </p>
                    </article>
                    <article className="finance-panel p-5">
                      <p className="finance-label">{t.totalExpenseBasis}</p>
                      <p className="mt-3 text-2xl font-semibold">
                        {totalExpenseHkd.toLocaleString("en-HK", { style: "currency", currency: "HKD" })}
                      </p>
                    </article>
                  </section>

                  <div className="grid gap-6 border-t-4 border-black pt-8 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
                    <ProjectionChart projections={projections} t={t} />

                    <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-1">
                      <RecordsPanel records={incomeRecords} type="income" t={t} />
                      <RecordsPanel
                        records={expenseMode === "detailed" ? expenseRecords : expenseBuckets}
                        type={expenseMode === "detailed" ? "expenses" : "buckets"}
                        t={t}
                      />
                    </div>
                  </div>
                </div>
              )}

              {activeSection === "record" && (
                <div className="space-y-6">
                  <div className="flex flex-wrap gap-3 border-b-4 border-black pb-4">
                    <NavButton active={recordSection === "quick-add"} onClick={() => setRecordSection("quick-add")}>
                      {t.quickAdd}
                    </NavButton>
                    <NavButton active={recordSection === "manage"} onClick={() => setRecordSection("manage")}>
                      {t.manage}
                    </NavButton>
                  </div>

                  {recordSection === "quick-add" ? (
                    <section>
                      <div className="mb-5 grid gap-3 lg:grid-cols-[minmax(0,0.35fr)_minmax(0,0.65fr)]">
                        <h2 className="text-4xl font-semibold leading-none">{t.quickAdd}</h2>
                        <p className="text-lg leading-7 text-neutral-700">
                          {t.recordWorkspace}
                        </p>
                      </div>
                      <div className="grid gap-6 xl:grid-cols-2">
                        <div className="space-y-6">
                          <IncomeForm isSimpleMode={expenseMode === "simple"} onSaved={loadDashboardData} t={t} />
                          <IncomeCsvImport language={language} onImported={loadDashboardData} t={t} />
                        </div>
                        {expenseMode === "detailed" ? (
                          <ExpenseRecordForm onSaved={loadDashboardData} t={t} />
                        ) : (
                          <ExpenseBucketForm onSaved={loadDashboardData} t={t} />
                        )}
                      </div>
                    </section>
                  ) : (
                    <ManageRecords
                      expenseBuckets={expenseBuckets}
                      expenseMode={expenseMode}
                      expenseRecords={expenseRecords}
                      incomeRecords={incomeRecords}
                      onChanged={loadDashboardData}
                      t={t}
                    />
                  )}
                </div>
              )}

              {activeSection === "account" && (
                <section className="finance-panel p-6">
                  <p className="finance-label">{t.account}</p>
                  <h2 className="mt-2 text-4xl font-semibold leading-none">{t.accountSettings}</h2>
                  <div className="mt-6 grid gap-6 lg:grid-cols-2">
                    <div>
                      <p className="finance-label">{t.email}</p>
                      <p className="mt-2 break-words text-lg font-semibold">{accountName}</p>
                    </div>
                    <div>
                      <p className="finance-label">{t.projectionWindow}</p>
                      <p className="finance-muted mt-2">
                        {language === "zh-Hant"
                          ? `總覽會顯示由 ${startMonth} 開始的 ${projectionMonths} 個月預測。這由 UserSettings 的 projection_months 控制。`
                          : `The dashboard shows ${projectionMonths} months from ${startMonth}. This is controlled by projection_months in your UserSettings record.`}
                      </p>
                    </div>
                    <div>
                      <p className="finance-label mb-2">{t.language}</p>
                      <div className="flex flex-wrap gap-2">
                        {LANGUAGE_OPTIONS.map((option) => (
                          <Button
                            key={option.value}
                            onClick={() => handleLanguageChange(option.value)}
                            type="button"
                            variant={language === option.value ? undefined : "ghost"}
                          >
                            {option.label}
                          </Button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="finance-label mb-2">{t.expenseMode}</p>
                      <ModeSwitch
                        disabled={isSavingMode}
                        mode={expenseMode}
                        onChange={handleModeChange}
                      />
                    </div>
                    <div className="flex items-end">
                      <Button className="gap-2 border-black bg-black text-white hover:bg-white hover:text-black" onClick={onLogout} type="button">
                        <LogOut className="h-4 w-4" strokeWidth={1.5} />
                        {t.logout}
                      </Button>
                    </div>
                  </div>
                </section>
              )}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
