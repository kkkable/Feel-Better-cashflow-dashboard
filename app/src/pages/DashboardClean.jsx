import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, LogIn, LogOut, RefreshCcw } from "lucide-react";
import {
  listExpenseRecords,
  listIncomeRecords,
  updateUserSettings,
} from "@/api/financeApi";
import FeelBetterMode from "@/components/dashboard/FeelBetterMode";
import DashboardAnalyticsCharts from "@/components/dashboard/DashboardAnalyticsCharts";
import DashboardInsightMetrics from "@/components/dashboard/DashboardInsightMetrics";
import ManageRecords from "@/components/dashboard/ManageRecords";
import MetricCards from "@/components/dashboard/MetricCards";
import ModeSwitch from "@/components/dashboard/ModeSwitch";
import ProjectionChart from "@/components/dashboard/ProjectionChart";
import RecordsPanel from "@/components/dashboard/RecordsPanel";
import TelegramBotPage, { SignalLogo, TelegramLogo } from "@/components/dashboard/TelegramBotPage";
import TutorialGuide from "@/components/dashboard/TutorialGuide";
import ExpenseRecordForm from "@/components/forms/ExpenseRecordForm";
import IncomeCsvImport from "@/components/forms/IncomeCsvImport";
import IncomeForm from "@/components/forms/IncomeForm";
import { Button } from "@/components/ui/button";
import {
  buildCategoryBreakdown,
  buildRecurringMix,
  buildThisMonthMetrics,
} from "@/lib/dashboardAnalytics";
import { getTranslations, LANGUAGE_OPTIONS, normalizeLanguage } from "@/lib/i18n";
import { formatDashboardMoney, normalizeCurrency, SUPPORTED_CURRENCIES } from "@/lib/money";
import { getMoneyWeather } from "@/lib/moneyWeather";
import { buildMonthlyProjection } from "@/lib/projections";
import { getNonMonthlyRecords } from "@/lib/recentRecords";
import {
  buildAdvanceTutorialPatch,
  buildBackTutorialPatch,
  buildResetTutorialPatch,
  buildSkipTutorialPatch,
  buildStartTutorialPatch,
  getVisibleTutorial,
} from "@/lib/tutorialState";

const FORECAST_MONTH_OPTIONS = [3, 6, 12];

function getCurrentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function getErrorMessage(error, fallback) {
  return error instanceof Error ? error.message : fallback;
}

function NavButton({ active, children, compact = false, onClick, tutorialTarget }) {
  return (
    <button
      className={`${compact ? "w-auto" : "w-full"} border-2 border-black px-4 py-3 text-left text-xs font-semibold uppercase tracking-widest transition-none focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-black ${
        active ? "bg-black text-white" : "bg-white text-black hover:bg-black hover:text-white"
      }`}
      data-tutorial-target={tutorialTarget}
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

function getTutorialCopy(t, page, step) {
  const copy = {
    dashboard: [
      {
        title: t.tutorialDashboardStep1Title,
        body: t.tutorialDashboardStep1Body,
        targetSelector: '[data-tutorial-target="dashboard-metric-cashflow"]',
      },
      {
        title: t.tutorialDashboardStep2Title,
        body: t.tutorialDashboardStep2Body,
        targetSelector: '[data-tutorial-target="dashboard-projection"]',
      },
      {
        title: t.tutorialDashboardStep3Title,
        body: t.tutorialDashboardStep3Body,
        targetSelector: '[data-tutorial-target="nav-record"]',
        secondaryTargetSelector: '[data-tutorial-target="nav-connect-bot"]',
      },
    ],
    record: [
      {
        title: t.tutorialRecordStep1Title,
        body: t.tutorialRecordStep1Body,
        targetSelector: '[data-tutorial-target="record-income-form"]',
        secondaryTargetSelector: '[data-tutorial-target="record-expense-form"]',
      },
      {
        title: t.tutorialRecordStep2Title,
        body: t.tutorialRecordStep2Body,
        targetSelector: '[data-tutorial-target="record-csv-import"]',
      },
      {
        title: t.tutorialRecordStep3Title,
        body: t.tutorialRecordStep3Body,
        targetSelector: '[data-tutorial-target="record-manage-button"]',
      },
      {
        title: t.tutorialRecordStep4Title,
        body: t.tutorialRecordStep4Body,
        targetSelector: '[data-tutorial-target="manage-income-recurring-switch"]',
      },
    ],
    telegram: [
      {
        title: t.tutorialBotStep1Title,
        body: t.tutorialBotStep1Body,
        targetSelector: '[data-tutorial-target="bot-setup"]',
        showArrow: false,
      },
      {
        title: t.tutorialBotStep2Title,
        body: t.tutorialBotStep2Body,
        targetSelector: '[data-tutorial-target="bot-setup"]',
      },
      {
        title: t.tutorialBotStep3Title,
        body: t.tutorialBotStep3Body,
        targetSelector: '[data-tutorial-target="bot-drafts"]',
      },
    ],
    "feel-better": [
      {
        title: t.tutorialFeelStep1Title,
        body: t.tutorialFeelStep1Body,
        targetSelector: '[data-tutorial-target="feel-better-input"]',
      },
      {
        title: t.tutorialFeelStep2Title,
        body: t.tutorialFeelStep2Body,
        targetSelector: '[data-tutorial-target="feel-better-response"]',
      },
    ],
  };

  const steps = copy[page] || [];
  const currentStep = steps[Math.max(step - 1, 0)] || {};
  return {
    body: currentStep.body || "",
    isFinalStep: step >= steps.length,
    secondaryTargetSelector: currentStep.secondaryTargetSelector,
    showArrow: currentStep.showArrow !== false,
    stepLabel: `${step} / ${steps.length}`,
    targetSelector: currentStep.targetSelector,
    title: currentStep.title || "",
  };
}

export default function DashboardClean({
  accountName,
  initialSettings,
  isGuest = false,
  onLoginRequest,
  onLogout,
}) {
  const isMountedRef = useRef(false);
  const [settings, setSettings] = useState(initialSettings);
  const [incomeRecords, setIncomeRecords] = useState([]);
  const [expenseRecords, setExpenseRecords] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [isSavingMode, setIsSavingMode] = useState(false);
  const [isSavingProjectionMonths, setIsSavingProjectionMonths] = useState(false);
  const [modeError, setModeError] = useState("");
  const [activeSection, setActiveSection] = useState("dashboard");
  const [recordSection, setRecordSection] = useState("quick-add");
  const [manageFocusTarget, setManageFocusTarget] = useState("");

  const expenseMode = settings?.expense_mode === "detailed" ? "detailed" : "simple";
  const baseCurrency = normalizeCurrency(settings?.base_currency || "HKD");
  const configuredProjectionMonths = Number(settings?.projection_months);
  const projectionMonths = FORECAST_MONTH_OPTIONS.includes(configuredProjectionMonths)
    ? configuredProjectionMonths
    : 6;
  const language = normalizeLanguage(settings?.language);
  const t = getTranslations(language);
  const visibleTutorial = getVisibleTutorial(activeSection, settings);
  const tutorialCopy = visibleTutorial
    ? getTutorialCopy(t, visibleTutorial.page, visibleTutorial.step)
    : null;
  const startMonth = useMemo(() => getCurrentMonth(), []);

  const loadDashboardData = useCallback(async () => {
    if (!isMountedRef.current) return;

    setIsLoading(true);
    setLoadError("");

    try {
      const [income, expenses] = await Promise.all([
        listIncomeRecords(),
        listExpenseRecords(),
      ]);

      if (!isMountedRef.current) return;

      setIncomeRecords(Array.isArray(income) ? income : []);
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
        includeActualSpending: true,
        incomeRecords,
        expenseBuckets: [],
        expenseRecords,
      });
    } catch {
      return [];
    }
  }, [
    expenseRecords,
    incomeRecords,
    projectionMonths,
    startMonth,
  ]);

  const currentProjection = projections[0];
  const totalIncomeHkd = useMemo(
    () => sumBy(incomeRecords, (record) => record.amount_hkd),
    [incomeRecords],
  );
  const totalExpenseHkd = useMemo(
    () => sumBy(expenseRecords, (record) => record.amount_hkd),
    [expenseRecords],
  );
  const recentIncomeRecords = useMemo(
    () => getNonMonthlyRecords(incomeRecords),
    [incomeRecords],
  );
  const recentExpenseRecords = useMemo(
    () => getNonMonthlyRecords(expenseRecords),
    [expenseRecords],
  );
  const thisMonthMetrics = useMemo(
    () =>
      buildThisMonthMetrics({
        month: startMonth,
        incomeRecords,
        expenseBuckets: [],
        expenseRecords,
      }),
    [expenseRecords, incomeRecords, startMonth],
  );
  const categoryBreakdown = useMemo(
    () =>
      buildCategoryBreakdown({
        month: startMonth,
        expenseRecords,
      }),
    [expenseRecords, startMonth],
  );
  const recurringMix = useMemo(
    () =>
      buildRecurringMix({
        month: startMonth,
        incomeRecords,
        expenseBuckets: [],
        expenseRecords,
      }),
    [expenseRecords, incomeRecords, startMonth],
  );
  const hasFinanceRecords = incomeRecords.length > 0 || expenseRecords.length > 0;
  const moneyWeather = useMemo(
    () =>
      getMoneyWeather({
        hasRecords: hasFinanceRecords,
        currentIncomeHkd: currentProjection?.projectedIncomeHkd ?? totalIncomeHkd,
        currentExpenseHkd: currentProjection?.projectedExpensesHkd ?? totalExpenseHkd,
        projectedCashflowHkd: currentProjection?.projectedCashflowHkd ?? 0,
      }),
    [
      currentProjection?.projectedCashflowHkd,
      currentProjection?.projectedExpensesHkd,
      currentProjection?.projectedIncomeHkd,
      hasFinanceRecords,
      totalExpenseHkd,
      totalIncomeHkd,
    ],
  );
  const pageClassName =
    activeSection === "dashboard" && moneyWeather !== "none"
      ? `finance-page finance-weather-page finance-weather-page-${moneyWeather}`
      : "finance-page";
  const shellClassName = "finance-shell finance-weather-content";

  const handleModeChange = async (mode) => {
    if (mode === expenseMode || isSavingMode) return;

    if (!settings?.id) {
      setModeError(t.missingSettings);
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
      setModeError(getErrorMessage(error, t.unableUpdateMode));
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
      setModeError(getErrorMessage(error, t.unableUpdateLanguage));
    }
  };

  const handleCurrencyChange = async (nextCurrency) => {
    const normalizedCurrency = normalizeCurrency(nextCurrency);
    if (normalizedCurrency === baseCurrency || !settings?.id) return;

    const patch = { base_currency: normalizedCurrency };
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
      setModeError(getErrorMessage(error, t.unableUpdateCurrency || "Unable to update currency."));
    }
  };

  const handleProjectionMonthsChange = async (months) => {
    if (months === projectionMonths || isSavingProjectionMonths) return;

    if (!settings?.id) {
      setModeError(t.missingSettings);
      return;
    }

    const normalizedMonths = FORECAST_MONTH_OPTIONS.includes(months) ? months : 6;
    const patch = { projection_months: normalizedMonths };

    setIsSavingProjectionMonths(true);
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
      setModeError(getErrorMessage(error, t.unableUpdateProjection));
    } finally {
      if (isMountedRef.current) {
        setIsSavingProjectionMonths(false);
      }
    }
  };

  function handleMetricNavigation(metricKey) {
    setManageFocusTarget(metricKey === "income" ? "income" : "expense");
    setRecordSection("manage");
    setActiveSection("record");
  }

  const saveTutorialPatch = useCallback(
    async (patch) => {
      if (!settings?.id || !patch || Object.keys(patch).length === 0) return;

      try {
        const updatedSettings = await updateUserSettings(settings.id, patch);
        if (!isMountedRef.current) return;

        setSettings((previousSettings) => ({
          ...previousSettings,
          ...patch,
          ...(updatedSettings || {}),
        }));
        setModeError("");
      } catch (error) {
        if (!isMountedRef.current) return;
        setModeError(getErrorMessage(error, t.unableUpdateTutorial || "Unable to update tutorial tips."));
      }
    },
    [settings?.id, t.unableUpdateTutorial],
  );

  useEffect(() => {
    if (!visibleTutorial?.shouldPersistStart) return;
    saveTutorialPatch(buildStartTutorialPatch(visibleTutorial.page));
  }, [saveTutorialPatch, visibleTutorial?.page, visibleTutorial?.shouldPersistStart]);

  useEffect(() => {
    if (visibleTutorial?.page !== "record") return;
    const nextSection = visibleTutorial.step === 4 ? "manage" : "quick-add";
    setRecordSection((previousSection) => (
      previousSection === nextSection ? previousSection : nextSection
    ));
  }, [visibleTutorial?.page, visibleTutorial?.step]);

  const handleTutorialNext = () => {
    if (!visibleTutorial) return;
    saveTutorialPatch(buildAdvanceTutorialPatch(visibleTutorial.page, visibleTutorial.step));
  };

  const handleTutorialBack = () => {
    if (!visibleTutorial) return;
    saveTutorialPatch(buildBackTutorialPatch(visibleTutorial.page, visibleTutorial.step));
  };

  const handleTutorialSkip = () => {
    saveTutorialPatch(buildSkipTutorialPatch());
  };

  const handleTutorialReset = () => {
    saveTutorialPatch(buildResetTutorialPatch());
  };

  return (
    <main className={pageClassName}>
      <div className={shellClassName}>
        <header className="relative border-b-4 border-black pb-6">
          {isGuest && (
            <button
              className="absolute right-0 top-0 z-10 inline-flex items-center gap-2 border-2 border-black bg-white px-3 py-2 text-[10px] font-semibold uppercase tracking-widest text-black transition-none hover:bg-black hover:text-white focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-black"
              onClick={onLoginRequest}
              type="button"
            >
              <LogIn className="h-3.5 w-3.5" strokeWidth={1.5} />
              Login/Register
            </button>
          )}
          <p className="finance-label">{t.appEyebrow}</p>
          <h1 className="mt-2 max-w-4xl text-5xl font-semibold leading-none tracking-normal sm:text-6xl lg:text-7xl">
            {t.appTitle}
          </h1>
          <p className="mt-4 max-w-2xl text-lg leading-7 text-neutral-700">
            {t.projectionSummary(projectionMonths, startMonth, baseCurrency)}
          </p>
          <img
            alt=""
            aria-hidden="true"
            className={`pointer-events-none absolute right-0 hidden h-24 w-24 object-contain sm:block lg:h-28 lg:w-28 ${
              isGuest ? "top-14" : "top-8"
            }`}
            src="/assets/finance-logo.png"
          />
        </header>

        {modeError && <p className="finance-error mt-4">{modeError}</p>}

        {isLoading ? (
          <section className="flex min-h-[45vh] items-center justify-center">
            <div className="text-center">
              <div className="mx-auto mb-4 h-8 w-8 animate-spin border-2 border-black border-t-white" />
              <p className="finance-muted">{t.loadingDashboardData}</p>
            </div>
          </section>
        ) : loadError ? (
          <section className="finance-panel mt-8 p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex gap-3">
                <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" strokeWidth={1.5} />
                <div>
                  <h2 className="finance-card-title">{t.loadErrorTitle}</h2>
                  <p className="finance-muted mt-2">{loadError}</p>
                </div>
              </div>
              <Button className="gap-2" onClick={loadDashboardData} type="button">
                <RefreshCcw className="h-4 w-4" />
                {t.retry}
              </Button>
            </div>
          </section>
        ) : (
          <div className="mt-8 grid gap-8 lg:grid-cols-[14rem_minmax(0,1fr)]">
            <aside className="space-y-3 lg:sticky lg:top-6 lg:self-start">
              <NavButton active={activeSection === "dashboard"} onClick={() => setActiveSection("dashboard")} tutorialTarget="nav-dashboard">
                {t.dashboard}
              </NavButton>
              <NavButton active={activeSection === "record"} onClick={() => setActiveSection("record")} tutorialTarget="nav-record">
                {t.navRecord}
              </NavButton>
              <NavButton active={activeSection === "telegram"} onClick={() => setActiveSection("telegram")} tutorialTarget="nav-connect-bot">
                <span className="flex items-center gap-2">
                  {t.connectBot || t.connectTelegramBot}
                  <TelegramLogo className="h-4 w-4" />
                  <SignalLogo className="h-4 w-4" />
                </span>
              </NavButton>
              <NavButton active={activeSection === "feel-better"} onClick={() => setActiveSection("feel-better")} tutorialTarget="nav-feel-better">
                {t.feelBetter}
              </NavButton>
              <NavButton active={activeSection === "account"} onClick={() => setActiveSection("account")} tutorialTarget="nav-account">
                {t.account}
              </NavButton>
            </aside>

            <div className="min-w-0">
              {activeSection === "dashboard" && (
                <div className="space-y-8">
                  <MetricCards currency={baseCurrency} onMetricClick={handleMetricNavigation} projection={currentProjection} t={t} />
                  {visibleTutorial?.page === "dashboard" && tutorialCopy && (
                    <TutorialGuide
                      backLabel={t.tutorialBack}
                      body={tutorialCopy.body}
                      canGoBack={visibleTutorial.step > 1}
                      gotItLabel={t.tutorialGotIt}
                      isFinalStep={tutorialCopy.isFinalStep}
                      nextLabel={t.tutorialNext}
                      onBack={handleTutorialBack}
                      onNext={handleTutorialNext}
                      onSkip={handleTutorialSkip}
                      secondaryTargetSelector={tutorialCopy.secondaryTargetSelector}
                      showArrow={tutorialCopy.showArrow}
                      skipLabel={t.tutorialSkipTips}
                      stepLabel={tutorialCopy.stepLabel}
                      targetSelector={tutorialCopy.targetSelector}
                      title={tutorialCopy.title}
                    />
                  )}
                  <DashboardInsightMetrics currency={baseCurrency} metrics={thisMonthMetrics} t={t} />

                  {expenseMode === "detailed" && (
                    <>
                      <section className="grid gap-4 md:grid-cols-4">
                        <article className="finance-panel p-5">
                          <p className="finance-label">{t.incomeRecords}</p>
                          <p className="mt-3 text-3xl font-semibold">{incomeRecords.length}</p>
                        </article>
                        <article className="finance-panel p-5">
                          <p className="finance-label">{t.expenseRecords}</p>
                          <p className="mt-3 text-3xl font-semibold">{expenseRecords.length}</p>
                        </article>
                        <article className="finance-panel p-5">
                          <p className="finance-label">{t.totalIncomeEntered}</p>
                          <p className="finance-dashboard-total mt-3">{formatDashboardMoney(totalIncomeHkd, baseCurrency)}</p>
                        </article>
                        <article className="finance-panel p-5">
                          <p className="finance-label">{t.totalExpenseBasis}</p>
                          <p className="finance-dashboard-total mt-3">{formatDashboardMoney(totalExpenseHkd, baseCurrency)}</p>
                        </article>
                      </section>

                      <DashboardAnalyticsCharts
                        categoryBreakdown={categoryBreakdown}
                        currency={baseCurrency}
                        recurringMix={recurringMix}
                        t={t}
                      />
                    </>
                  )}

                  <div className="grid gap-6 border-t-4 border-black pt-8 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
                    <ProjectionChart currency={baseCurrency} projections={projections} t={t} />

                    <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-1">
                      <RecordsPanel currency={baseCurrency} records={recentIncomeRecords} type="income" t={t} />
                      <RecordsPanel currency={baseCurrency} records={recentExpenseRecords} type="expenses" t={t} />
                    </div>
                  </div>
                </div>
              )}

              {activeSection === "feel-better" && (
                <>
                  {visibleTutorial?.page === "feel-better" && tutorialCopy && (
                    <TutorialGuide
                      backLabel={t.tutorialBack}
                      body={tutorialCopy.body}
                      canGoBack={visibleTutorial.step > 1}
                      gotItLabel={t.tutorialGotIt}
                      isFinalStep={tutorialCopy.isFinalStep}
                      nextLabel={t.tutorialNext}
                      onBack={handleTutorialBack}
                      onNext={handleTutorialNext}
                      onSkip={handleTutorialSkip}
                      secondaryTargetSelector={tutorialCopy.secondaryTargetSelector}
                      showArrow={tutorialCopy.showArrow}
                      skipLabel={t.tutorialSkipTips}
                      stepLabel={tutorialCopy.stepLabel}
                      targetSelector={tutorialCopy.targetSelector}
                      title={tutorialCopy.title}
                    />
                  )}
                  <FeelBetterMode
                    defaultExpenseHkd={currentProjection?.projectedExpensesHkd ?? thisMonthMetrics.expenseHkd}
                    defaultIncomeHkd={currentProjection?.projectedIncomeHkd ?? thisMonthMetrics.incomeHkd}
                    currency={baseCurrency}
                    language={language}
                    t={t}
                  />
                </>
              )}

              {activeSection === "record" && (
                <div className="space-y-6">
                  <div className="flex flex-wrap gap-3 border-b-4 border-black pb-4">
                    <NavButton compact active={recordSection === "quick-add"} onClick={() => setRecordSection("quick-add")} tutorialTarget="record-quick-add-button">
                      {t.quickAdd}
                    </NavButton>
                    <NavButton compact active={recordSection === "manage"} onClick={() => setRecordSection("manage")} tutorialTarget="record-manage-button">
                      {t.manage}
                    </NavButton>
                  </div>
                  {visibleTutorial?.page === "record" && tutorialCopy && (
                    <TutorialGuide
                      backLabel={t.tutorialBack}
                      body={tutorialCopy.body}
                      canGoBack={visibleTutorial.step > 1}
                      gotItLabel={t.tutorialGotIt}
                      isFinalStep={tutorialCopy.isFinalStep}
                      nextLabel={t.tutorialNext}
                      onBack={handleTutorialBack}
                      onNext={handleTutorialNext}
                      onSkip={handleTutorialSkip}
                      secondaryTargetSelector={tutorialCopy.secondaryTargetSelector}
                      showArrow={tutorialCopy.showArrow}
                      skipLabel={t.tutorialSkipTips}
                      stepLabel={tutorialCopy.stepLabel}
                      targetSelector={tutorialCopy.targetSelector}
                      title={tutorialCopy.title}
                    />
                  )}

                  {recordSection === "quick-add" ? (
                    <section>
                      <div className="mb-5 grid gap-3 lg:grid-cols-[minmax(0,0.35fr)_minmax(0,0.65fr)]">
                        <h2 className="text-4xl font-semibold leading-none">{t.quickAdd}</h2>
                        <p className="text-lg leading-7 text-neutral-700">{t.recordWorkspace}</p>
                      </div>
                      <div className="grid gap-6 xl:grid-cols-2">
                        <div className="space-y-6">
                          <div data-tutorial-target="record-income-form">
                            <IncomeForm currency={baseCurrency} isSimpleMode={expenseMode === "simple"} onSaved={loadDashboardData} t={t} />
                          </div>
                          <div data-tutorial-target="record-csv-import">
                            <IncomeCsvImport language={language} onImported={loadDashboardData} t={t} />
                          </div>
                        </div>
                        {expenseMode === "detailed" ? (
                          <div data-tutorial-target="record-expense-form">
                            <ExpenseRecordForm currency={baseCurrency} onSaved={loadDashboardData} t={t} />
                          </div>
                        ) : (
                          <div data-tutorial-target="record-expense-form">
                            <ExpenseRecordForm currency={baseCurrency} isSimpleMode onSaved={loadDashboardData} t={t} />
                          </div>
                        )}
                      </div>
                    </section>
                  ) : (
                    <ManageRecords
                      expenseMode={expenseMode}
                      expenseRecords={expenseRecords}
                      focusTarget={manageFocusTarget}
                      currency={baseCurrency}
                      incomeRecords={incomeRecords}
                      onChanged={loadDashboardData}
                      t={t}
                    />
                  )}
                </div>
              )}

              {activeSection === "telegram" && (
                <>
                  <TelegramBotPage
                    accountName={accountName}
                    currency={baseCurrency}
                    isGuest={isGuest}
                    language={language}
                    onRecordsChanged={loadDashboardData}
                    t={t}
                  />
                  {visibleTutorial?.page === "telegram" && tutorialCopy && (
                    <TutorialGuide
                      backLabel={t.tutorialBack}
                      body={tutorialCopy.body}
                      canGoBack={visibleTutorial.step > 1}
                      gotItLabel={t.tutorialGotIt}
                      isFinalStep={tutorialCopy.isFinalStep}
                      nextLabel={t.tutorialNext}
                      onBack={handleTutorialBack}
                      onNext={handleTutorialNext}
                      onSkip={handleTutorialSkip}
                      secondaryTargetSelector={tutorialCopy.secondaryTargetSelector}
                      showArrow={tutorialCopy.showArrow}
                      skipLabel={t.tutorialSkipTips}
                      stepLabel={tutorialCopy.stepLabel}
                      targetSelector={tutorialCopy.targetSelector}
                      title={tutorialCopy.title}
                    />
                  )}
                </>
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
                      <p className="finance-label mb-2">{t.forecastMonths}</p>
                      <div className="inline-flex w-full border-2 border-black bg-white sm:w-auto">
                        {FORECAST_MONTH_OPTIONS.map((months) => {
                          const isSelected = projectionMonths === months;

                          return (
                            <button
                              className={`min-h-11 flex-1 border-r-2 border-black px-4 text-xs font-semibold uppercase tracking-widest last:border-r-0 sm:min-w-24 ${
                                isSelected
                                  ? "bg-black text-white"
                                  : "bg-white text-black hover:bg-black hover:text-white"
                              }`}
                              disabled={isSavingProjectionMonths}
                              key={months}
                              onClick={() => handleProjectionMonthsChange(months)}
                              type="button"
                            >
                              {t.monthsOption(months)}
                            </button>
                          );
                        })}
                      </div>
                      <div className="mt-4">
                        <p className="finance-muted mt-2">
                          {t.projectionWindowDetail(projectionMonths, startMonth)}
                        </p>
                      </div>
                    </div>
                  <div>
                      <p className="finance-label mb-2">{t.currency || "Currency"}</p>
                      <select
                        className="finance-input"
                        onChange={(event) => handleCurrencyChange(event.target.value)}
                        value={baseCurrency}
                      >
                        {SUPPORTED_CURRENCIES.map((currency) => (
                          <option key={currency} value={currency}>
                            {currency}
                          </option>
                        ))}
                      </select>
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
                        t={t}
                      />
                    </div>
                    <div>
                      <p className="finance-label mb-2">{t.tutorialShowTipsAgain}</p>
                      <Button onClick={handleTutorialReset} type="button" variant="ghost">
                        {t.tutorialShowTipsAgain}
                      </Button>
                      {settings?.tutorial_dismissed === false && (
                        <p className="finance-muted mt-2">{t.tutorialTipsReset}</p>
                      )}
                    </div>
                    <div className="flex items-end">
                      {isGuest ? (
                        <Button className="gap-2" onClick={onLoginRequest} type="button">
                          <LogIn className="h-4 w-4" strokeWidth={1.5} />
                          Login/Register
                        </Button>
                      ) : (
                        <Button className="gap-2 border-black bg-red-700 text-white hover:bg-white hover:text-red-700" onClick={onLogout} type="button">
                          <LogOut className="h-4 w-4" strokeWidth={1.5} />
                          {t.logout}
                        </Button>
                      )}
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
