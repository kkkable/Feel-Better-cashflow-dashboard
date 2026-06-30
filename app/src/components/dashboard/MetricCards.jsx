import { ArrowDownCircle, ArrowUpCircle, WalletCards } from "lucide-react";
import { formatDashboardMoney } from "@/lib/money";

const metrics = (t) => [
  {
    key: "income",
    label: t.topThisMonthIncome,
    field: "projectedIncomeHkd",
    Icon: ArrowUpCircle,
  },
  {
    key: "expenses",
    label: t.topThisMonthExpense,
    field: "projectedExpensesHkd",
    Icon: ArrowDownCircle,
  },
  {
    key: "cashflow",
    label: t.topNetCashflow,
    field: "projectedCashflowHkd",
    Icon: WalletCards,
  },
];

export default function MetricCards({ currency = "HKD", onMetricClick, projection, t }) {
  return (
    <section className="grid gap-4 md:grid-cols-3">
      {metrics(t).map(({ key, label, field, Icon }) => {
        const value = projection?.[field] ?? 0;
        const isInverted = key === "cashflow";
        const isClickable = key === "income" || key === "expenses";
        const Wrapper = isClickable ? "button" : "article";

        return (
          <Wrapper
            className={`${isInverted ? "finance-panel-inverted" : "finance-panel"} w-full p-5 text-left transition-none ${
              isClickable
                ? "cursor-pointer hover:bg-black hover:text-white focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-black"
                : ""
            }`}
            data-tutorial-target={`dashboard-metric-${key}`}
            key={key}
            onClick={isClickable ? () => onMetricClick?.(key) : undefined}
            type={isClickable ? "button" : undefined}
          >
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-semibold uppercase tracking-widest">{label}</p>
              <Icon className="h-5 w-5 shrink-0" strokeWidth={1.5} />
            </div>
            <p
              className="mt-5 break-words text-3xl font-semibold leading-tight tracking-normal"
            >
              {formatDashboardMoney(value, currency)}
            </p>
            <p className="mt-3 text-xs font-semibold uppercase tracking-widest opacity-70">
              {projection?.month ?? "-"}
            </p>
          </Wrapper>
        );
      })}
    </section>
  );
}
