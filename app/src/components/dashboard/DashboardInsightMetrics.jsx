import { CalendarDays, PiggyBank, Repeat } from "lucide-react";
import { formatDashboardMoney } from "@/lib/money";

function formatRate(value) {
  return `${Number(value || 0).toFixed(1).replace(/\.0$/, "")}%`;
}

export default function DashboardInsightMetrics({ currency = "HKD", metrics, t }) {
  const cards = [
    {
      key: "savings-rate",
      label: t.savingsRate,
      value: formatRate(metrics.savingsRate),
      detail: metrics.month,
      Icon: PiggyBank,
    },
    {
      key: "recurring-income",
      label: t.recurringMonthlyIncome,
      value: formatDashboardMoney(metrics.recurringMonthlyIncomeHkd, currency),
      detail: t.monthly,
      Icon: Repeat,
    },
    {
      key: "recurring-expense",
      label: t.recurringMonthlyExpense,
      value: formatDashboardMoney(metrics.recurringMonthlyExpenseHkd, currency),
      detail: t.monthly,
      Icon: CalendarDays,
    },
  ];

  return (
    <section className="grid gap-4 md:grid-cols-3">
      {cards.map(({ key, label, value, detail, Icon }) => (
        <article className="finance-panel bg-white/90 p-5" key={key}>
          <div className="flex items-center justify-between gap-3">
            <p className="finance-label">{label}</p>
            <Icon className="h-5 w-5 shrink-0" strokeWidth={1.5} />
          </div>
          <p className="finance-dashboard-total mt-4">{value}</p>
          <p className="mt-3 text-xs font-semibold uppercase tracking-widest text-neutral-600">{detail}</p>
        </article>
      ))}
    </section>
  );
}
