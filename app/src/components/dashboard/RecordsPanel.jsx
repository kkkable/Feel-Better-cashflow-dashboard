import { Archive, Banknote, ReceiptText } from "lucide-react";
import { formatDashboardMoney } from "@/lib/money";

const panelConfig = (t) => ({
  income: {
    title: t.recentIncome,
    emptyTitle: t.noIncomeRecords,
    Icon: Banknote,
  },
  buckets: {
    title: t.expenseBuckets,
    emptyTitle: t.noRecords,
    Icon: Archive,
  },
  expenses: {
    title: t.recentExpense,
    emptyTitle: t.noRecords,
    Icon: ReceiptText,
  },
});

function titleCase(value, t) {
  if (!value) return t.noDetails;
  return String(value).replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function getAmount(record, type) {
  if (type === "buckets") {
    return record.planned_monthly_amount_hkd ?? record.amount_hkd ?? 0;
  }

  return record.amount_hkd ?? 0;
}

function getPrimary(record, type, t) {
  if (type === "income") return record.source || t.income;
  if (type === "expenses") return record.merchant || record.category || t.expenses;
  return record.name || record.category || t.expenseBuckets;
}

function getSecondary(record, type, t) {
  const pieces = [];

  if (record.category) pieces.push(titleCase(record.category, t));
  if (type !== "buckets" && record.date) pieces.push(record.date);
  if (type === "buckets") pieces.push(record.is_active === false ? t.inactive : t.active);
  if (record.is_recurring) pieces.push(t.recurring);

  return pieces.join(" | ");
}

export default function RecordsPanel({ currency = "HKD", records, type, t }) {
  const config = panelConfig(t)[type] || panelConfig(t).income;
  const Icon = config.Icon;
  const visibleRecords = Array.isArray(records) ? records.slice(0, 3) : [];

  return (
    <section className="finance-panel p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="finance-card-title">{config.title}</h2>
          <p className="finance-muted mt-1">
            {t.shownOf(visibleRecords.length, Array.isArray(records) ? records.length : 0)}
          </p>
        </div>
        <Icon className="h-5 w-5" strokeWidth={1.5} />
      </div>

      {visibleRecords.length === 0 ? (
        <div className="mt-5 border-2 border-dashed border-black px-4 py-8 text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-black">{config.emptyTitle}</p>
          <p className="finance-muted mt-1">
            {t.recordsWillAppearShort}
          </p>
        </div>
      ) : (
        <div className="mt-5 divide-y divide-neutral-200">
          {visibleRecords.map((record, index) => {
            const primary = getPrimary(record, type, t);
            const secondary = getSecondary(record, type, t);

            return (
              <div
                className="flex items-start justify-between gap-4 py-3 first:pt-0 last:pb-0"
                key={record.id || `${type}-${index}`}
              >
                <div className="min-w-0">
                  <p className="truncate text-base font-semibold text-black">{primary}</p>
                  <p className="mt-1 truncate text-xs font-semibold uppercase tracking-widest text-neutral-600">
                    {secondary || t.noDetails}
                  </p>
                </div>
                <p className="shrink-0 text-right text-sm font-semibold text-black">
                  {formatDashboardMoney(getAmount(record, type), currency)}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
