import { TrendingUp } from "lucide-react";
import { formatDashboardMoney } from "@/lib/money";

function getBarWidth(value, maxValue) {
  if (!maxValue) return "0%";
  return `${Math.max(3, Math.round((Math.abs(value) / maxValue) * 100))}%`;
}

export default function ProjectionChart({ currency = "HKD", projections, t }) {
  const maxValue = Math.max(
    0,
    ...projections.flatMap((row) => [
      Math.abs(row.projectedIncomeHkd || 0),
      Math.abs(row.projectedExpensesHkd || 0),
      Math.abs(row.projectedCashflowHkd || 0),
    ]),
  );

  return (
    <section className="finance-panel p-5" data-tutorial-target="dashboard-projection">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="finance-card-title">{t.projection}</h2>
          <p className="finance-muted mt-1">
            {t.projectionHelp}
          </p>
        </div>
        <TrendingUp className="hidden h-5 w-5 sm:block" strokeWidth={1.5} />
      </div>

      {projections.length === 0 ? (
        <div className="mt-6 border-2 border-dashed border-black px-4 py-8 text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-black">{t.noProjectionData}</p>
          <p className="finance-muted mt-1">
            Add income or expense records to populate the projection.
          </p>
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto">
          <div className="min-w-[640px] space-y-4">
            {projections.map((row) => {
              const cashflowIsNegative = row.projectedCashflowHkd < 0;

              return (
                <div
                  className="grid grid-cols-[5.5rem_minmax(0,1fr)_8.5rem] items-center gap-4 border-b border-neutral-200 pb-3 last:border-b-0"
                  key={row.month}
                >
                  <div className="text-xs font-semibold uppercase tracking-widest text-black">{row.month}</div>
                  <div className="space-y-2">
                    <div className="h-2 border border-black bg-white">
                      <div
                        className="h-full bg-black"
                        style={{
                          width: getBarWidth(row.projectedIncomeHkd, maxValue),
                        }}
                      />
                    </div>
                    <div className="h-2 border border-black bg-white">
                      <div
                        className="h-full bg-neutral-500"
                        style={{
                          width: getBarWidth(row.projectedExpensesHkd, maxValue),
                        }}
                      />
                    </div>
                    <div className="h-2 border border-black bg-white">
                      <div
                        className={`h-full ${cashflowIsNegative ? "bg-white outline outline-1 outline-black" : "bg-black"}`}
                        style={{
                          width: getBarWidth(row.projectedCashflowHkd, maxValue),
                        }}
                      />
                    </div>
                  </div>
                  <div
                    className="text-right text-sm font-semibold text-black"
                  >
                    {formatDashboardMoney(row.projectedCashflowHkd, currency)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-xs font-semibold uppercase tracking-widest text-black">
        <span className="inline-flex items-center gap-2">
          <span className="h-2 w-4 border border-black bg-black" />
          {t.income}
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="h-2 w-4 border border-black bg-neutral-500" />
          {t.expenses}
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="h-2 w-4 border border-black bg-white" />
          {t.cashflow}
        </span>
      </div>
    </section>
  );
}
