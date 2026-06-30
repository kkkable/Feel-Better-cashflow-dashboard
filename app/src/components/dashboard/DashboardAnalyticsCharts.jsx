import { Donut, SplitSquareHorizontal } from "lucide-react";
import { formatDashboardMoney } from "@/lib/money";

function titleCase(value, t) {
  if (!value) return t.noDetails;
  return String(value).replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function MiniEmpty({ t }) {
  return (
    <div className="mt-5 border-2 border-dashed border-black px-4 py-8 text-center">
      <p className="text-sm font-semibold uppercase tracking-widest text-black">{t.noChartData}</p>
      <p className="finance-muted mt-1">{t.recordsWillAppearShort}</p>
    </div>
  );
}

function ChartPanel({ children, Icon, title }) {
  return (
    <section className="finance-panel bg-white/90 p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="finance-card-title">{title}</h2>
        <Icon className="h-5 w-5 shrink-0" strokeWidth={1.5} />
      </div>
      {children}
    </section>
  );
}

function ExpenseCategoryBreakdown({ currency, data, t }) {
  const total = data.reduce((sum, row) => sum + row.amountHkd, 0);
  let runningPercent = 0;

  return (
    <ChartPanel Icon={Donut} title={t.expenseCategoryBreakdown}>
      {total <= 0 ? (
        <MiniEmpty t={t} />
      ) : (
        <div className="mt-5 grid gap-5 sm:grid-cols-[10rem_minmax(0,1fr)] sm:items-center">
          <svg aria-label={t.expenseCategoryBreakdown} className="h-40 w-40" viewBox="0 0 120 120">
            <circle cx="60" cy="60" fill="none" r="42" stroke="#f5f5f5" strokeWidth="18" />
            {data.map((row, index) => {
              const percent = (row.amountHkd / total) * 100;
              const dash = `${percent} ${100 - percent}`;
              const offset = 25 - runningPercent;
              runningPercent += percent;

              return (
                <circle
                  cx="60"
                  cy="60"
                  fill="none"
                  key={row.category}
                  r="42"
                  stroke={index % 2 === 0 ? "#000" : "#737373"}
                  strokeDasharray={dash}
                  strokeDashoffset={offset}
                  strokeLinecap="butt"
                  strokeWidth="18"
                />
              );
            })}
            <text className="fill-black text-[10px] font-semibold" textAnchor="middle" x="60" y="57">
              {t.expenses}
            </text>
            <text className="fill-black text-[10px] font-semibold" textAnchor="middle" x="60" y="72">
              {formatDashboardMoney(total, currency)}
            </text>
          </svg>
          <div className="space-y-3">
            {data.slice(0, 5).map((row, index) => (
              <div className="flex items-center justify-between gap-3" key={row.category}>
                <p className="min-w-0 truncate text-sm font-semibold text-black">
                  <span className={`mr-2 inline-block h-2 w-4 border border-black ${index % 2 === 0 ? "bg-black" : "bg-neutral-500"}`} />
                  {titleCase(row.category, t)}
                </p>
                <p className="shrink-0 text-sm font-semibold text-black">{formatDashboardMoney(row.amountHkd, currency)}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </ChartPanel>
  );
}

function RecurringMixChart({ currency, data, t }) {
  const rows = [
    { key: "income", label: t.income, ...data.income },
    { key: "expenses", label: t.expenses, ...data.expenses },
  ];

  return (
    <ChartPanel Icon={SplitSquareHorizontal} title={t.recurringVsOneTime}>
      <div className="mt-5 space-y-5">
        {rows.map((row) => {
          const total = row.recurringHkd + row.oneTimeHkd;
          const recurringWidth = total > 0 ? (row.recurringHkd / total) * 100 : 0;
          const oneTimeWidth = total > 0 ? (row.oneTimeHkd / total) * 100 : 0;

          return (
            <div key={row.key}>
              <div className="mb-2 flex items-center justify-between gap-3">
                <p className="finance-label">{row.label}</p>
                <p className="text-sm font-semibold text-black">{formatDashboardMoney(total, currency)}</p>
              </div>
              <div className="flex h-5 border border-black bg-white">
                <div className="bg-black" style={{ width: `${recurringWidth}%` }} />
                <div className="bg-neutral-500" style={{ width: `${oneTimeWidth}%` }} />
              </div>
              <div className="mt-2 grid gap-1 text-xs font-semibold uppercase tracking-widest text-neutral-700 sm:grid-cols-2">
                <p>{t.recurring}: {formatDashboardMoney(row.recurringHkd, currency)}</p>
                <p>{t.oneTime}: {formatDashboardMoney(row.oneTimeHkd, currency)}</p>
              </div>
            </div>
          );
        })}
      </div>
    </ChartPanel>
  );
}

export default function DashboardAnalyticsCharts({ categoryBreakdown, currency = "HKD", recurringMix, t }) {
  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <ExpenseCategoryBreakdown currency={currency} data={categoryBreakdown} t={t} />
      <RecurringMixChart currency={currency} data={recurringMix} t={t} />
    </div>
  );
}
