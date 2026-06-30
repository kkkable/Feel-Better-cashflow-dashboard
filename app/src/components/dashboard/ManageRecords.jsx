import { useEffect, useMemo, useRef, useState } from "react";
import { Pencil, Save, Trash2, X } from "lucide-react";
import {
  deleteExpenseBucket,
  deleteExpenseRecord,
  deleteIncomeRecord,
  updateExpenseBucket,
  updateExpenseRecord,
  updateIncomeRecord,
} from "@/api/financeApi";
import { Button } from "@/components/ui/button";
import { buildExpenseBucketPayload, buildExpenseRecordPayload, buildIncomePayload } from "@/lib/formPayloads";
import { formatMoney } from "@/lib/money";

const PAGE_SIZE = 10;

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function titleCase(value) {
  return String(value || "other").replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function getErrorMessage(error, fallback) {
  return error instanceof Error ? error.message : fallback;
}

function getRecordAmount(record, type) {
  if (type === "bucket") return record.planned_monthly_amount_hkd ?? record.amount_original ?? 0;
  return record.amount_hkd ?? record.amount_original ?? 0;
}

function toForm(record, type) {
  if (type === "income") {
    return {
      name: record.source || "",
      amount: String(getRecordAmount(record, type) || ""),
      category: record.category || "salary",
      date: record.date || todayIso(),
      isRecurring: Boolean(record.is_recurring),
      notes: record.notes || "",
      paymentMethod: "",
    };
  }

  if (type === "bucket") {
    return {
      name: record.name || "",
      amount: String(getRecordAmount(record, type) || ""),
      category: record.category || "other",
      date: todayIso(),
      isRecurring: true,
      notes: record.notes || "",
      paymentMethod: "",
    };
  }

  return {
    name: record.merchant || "",
    amount: String(getRecordAmount(record, type) || ""),
    category: record.category || "other",
    date: record.date || todayIso(),
    isRecurring: Boolean(record.is_recurring),
    notes: record.notes || "",
    paymentMethod: record.payment_method || "",
  };
}

function ManageTable({ currency = "HKD", focusOnMount = false, records, title, type, onChanged, t }) {
  const sectionRef = useRef(null);
  const [editingId, setEditingId] = useState("");
  const [form, setForm] = useState(null);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");
  const [recurringFilter, setRecurringFilter] = useState("monthly");
  const [pageByFilter, setPageByFilter] = useState({ monthly: 1, oneTime: 1 });
  const canFilterRecurring = type !== "bucket";

  useEffect(() => {
    if (!focusOnMount) return;
    sectionRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
    sectionRef.current?.focus({ preventScroll: true });
  }, [focusOnMount]);

  const sortedRecords = useMemo(() => {
    const list = Array.isArray(records) ? [...records] : [];
    return list.sort((a, b) => String(b.date || b.created_date || "").localeCompare(String(a.date || a.created_date || "")));
  }, [records]);

  const visibleRecords = useMemo(() => {
    if (!canFilterRecurring) return sortedRecords;
    const showMonthly = recurringFilter === "monthly";
    return sortedRecords.filter((record) => Boolean(record.is_recurring) === showMonthly);
  }, [canFilterRecurring, recurringFilter, sortedRecords]);

  const pageCount = Math.max(1, Math.ceil(visibleRecords.length / PAGE_SIZE));
  const currentPage = Math.min(pageByFilter[recurringFilter] || 1, pageCount);
  const paginatedRecords = useMemo(() => {
    if (!canFilterRecurring) return visibleRecords;
    const startIndex = (currentPage - 1) * PAGE_SIZE;
    return visibleRecords.slice(startIndex, startIndex + PAGE_SIZE);
  }, [canFilterRecurring, currentPage, visibleRecords]);

  useEffect(() => {
    if (!canFilterRecurring) return;
    if ((pageByFilter[recurringFilter] || 1) <= pageCount) return;

    setPageByFilter((previousPages) => ({
      ...previousPages,
      [recurringFilter]: pageCount,
    }));
  }, [canFilterRecurring, pageByFilter, pageCount, recurringFilter]);

  function setCurrentPage(nextPage) {
    const safePage = Math.min(Math.max(nextPage, 1), pageCount);
    setPageByFilter((previousPages) => ({
      ...previousPages,
      [recurringFilter]: safePage,
    }));
  }

  function startEdit(record) {
    setError("");
    setEditingId(record.id);
    setForm(toForm(record, type));
  }

  async function saveRecord(record) {
    const numericAmount = Number(form?.amount);
    if (!form?.name.trim() || numericAmount <= 0 || (type !== "bucket" && !form.date)) {
      setError(t.missingRecordFields);
      return;
    }

    setBusyId(record.id);
    setError("");
    try {
      if (type === "income") {
        await updateIncomeRecord(record.id, buildIncomePayload({
          source: form.name,
          category: form.category,
          amount: numericAmount,
          date: form.date,
          isRecurring: form.isRecurring,
          notes: form.notes,
        }));
      } else if (type === "bucket") {
        await updateExpenseBucket(record.id, buildExpenseBucketPayload({
          name: form.name,
          amount: numericAmount,
          category: form.category,
          notes: form.notes,
        }));
      } else {
        await updateExpenseRecord(record.id, buildExpenseRecordPayload({
          merchant: form.name,
          category: form.category,
          amount: numericAmount,
          date: form.date,
          paymentMethod: form.paymentMethod,
          isRecurring: form.isRecurring,
          notes: form.notes,
        }));
      }

      setEditingId("");
      setForm(null);
      await onChanged?.();
    } catch (saveError) {
      setError(getErrorMessage(saveError, t.unableSaveRecord));
    } finally {
      setBusyId("");
    }
  }

  async function deleteRecord(record) {
    const confirmed = window.confirm(t.confirmDelete(record.source || record.merchant || record.name || t.record));
    if (!confirmed) return;

    setBusyId(record.id);
    setError("");
    try {
      if (type === "income") await deleteIncomeRecord(record.id);
      else if (type === "bucket") await deleteExpenseBucket(record.id);
      else await deleteExpenseRecord(record.id);
      await onChanged?.();
    } catch (deleteError) {
      setError(getErrorMessage(deleteError, t.unableDeleteRecord));
    } finally {
      setBusyId("");
    }
  }

  return (
    <section className="finance-panel p-5 focus:outline-none" ref={sectionRef} tabIndex={-1}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="finance-card-title">{title}</h2>
          <p className="finance-muted mt-1">
            {canFilterRecurring ? t.shownOf(visibleRecords.length, sortedRecords.length) : t.recordCount(sortedRecords.length)}
          </p>
        </div>
        {canFilterRecurring && (
          <div className="inline-flex self-start border-2 border-black" data-tutorial-target={type === "income" ? "manage-income-recurring-switch" : undefined}>
            <button
              className={`min-h-10 px-3 text-xs font-semibold uppercase tracking-widest ${recurringFilter === "monthly" ? "bg-black text-white" : "bg-white text-black"}`}
              onClick={() => setRecurringFilter("monthly")}
              type="button"
            >
              {t.recurringMonthly || t.monthly || "Monthly"}
            </button>
            <button
              className={`min-h-10 border-l-2 border-black px-3 text-xs font-semibold uppercase tracking-widest ${recurringFilter === "oneTime" ? "bg-black text-white" : "bg-white text-black"}`}
              onClick={() => setRecurringFilter("oneTime")}
              type="button"
            >
              {t.nonMonthly || "Non monthly"}
            </button>
          </div>
        )}
      </div>

      {error && <p className="finance-error mt-4">{error}</p>}

      <div className="mt-5 space-y-3">
        {visibleRecords.length === 0 ? (
          <div className="border-2 border-dashed border-black px-4 py-8 text-center">
            <p className="text-sm font-semibold uppercase tracking-widest text-black">{t.noRecords}</p>
            <p className="finance-muted mt-1">{t.recordsWillAppear}</p>
          </div>
        ) : (
          paginatedRecords.map((record) => {
            const isEditing = editingId === record.id;
            const currentForm = isEditing ? form : null;
            const titleText = record.source || record.merchant || record.name || "Record";

            return (
              <article className="border border-black p-4" key={record.id}>
                {isEditing ? (
                  <div className="space-y-3">
                    <div className="grid gap-3 md:grid-cols-2">
                      <label className="finance-label">
                        {t.name}
                        <input className="finance-input mt-1" onChange={(event) => setForm({ ...currentForm, name: event.target.value })} value={currentForm.name} />
                      </label>
                      <label className="finance-label">
                        {t.amountMoney?.(currency) || `${t.amountHkd || "Amount"} ${currency}`}
                        <input className="finance-input mt-1" min="0" onChange={(event) => setForm({ ...currentForm, amount: event.target.value })} step="0.01" type="number" value={currentForm.amount} />
                      </label>
                      {type !== "bucket" && (
                        <label className="finance-label">
                          {t.date}
                          <input className="finance-input mt-1" onChange={(event) => setForm({ ...currentForm, date: event.target.value })} type="date" value={currentForm.date} />
                        </label>
                      )}
                      <label className="finance-label">
                        {t.category}
                        <input className="finance-input mt-1" onChange={(event) => setForm({ ...currentForm, category: event.target.value })} value={currentForm.category} />
                      </label>
                      {type === "expense" && (
                        <label className="finance-label">
                          {t.paymentMethod}
                          <input className="finance-input mt-1" onChange={(event) => setForm({ ...currentForm, paymentMethod: event.target.value })} value={currentForm.paymentMethod} />
                        </label>
                      )}
                    </div>
                    {type !== "bucket" && (
                      <label className="finance-label flex items-center gap-2">
                        <input checked={currentForm.isRecurring} className="h-5 w-5 border-2 border-black" onChange={(event) => setForm({ ...currentForm, isRecurring: event.target.checked })} type="checkbox" />
                        {t.recurringMonthly}
                      </label>
                    )}
                    <label className="finance-label block">
                      {t.note}
                      <textarea className="finance-input mt-1 min-h-20 py-2" onChange={(event) => setForm({ ...currentForm, notes: event.target.value })} value={currentForm.notes} />
                    </label>
                    <div className="flex flex-wrap gap-2">
                      <Button className="gap-2" disabled={busyId === record.id} onClick={() => saveRecord(record)} type="button">
                        <Save className="h-4 w-4" strokeWidth={1.5} />
                        {t.save}
                      </Button>
                      <Button className="gap-2" onClick={() => { setEditingId(""); setForm(null); }} type="button" variant="ghost">
                        <X className="h-4 w-4" strokeWidth={1.5} />
                        {t.cancel}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="min-w-0">
                      <p className="truncate text-lg font-semibold text-black">{titleText}</p>
                      <p className="mt-1 text-xs font-semibold uppercase tracking-widest text-neutral-600">
                        {titleCase(record.category)} {record.date ? `| ${record.date}` : ""} {record.is_recurring ? `| ${t.recurring}` : ""}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="mr-2 text-base font-semibold text-black">{formatMoney(getRecordAmount(record, type), currency)}</p>
                      <Button aria-label={`Edit ${titleText}`} disabled={Boolean(busyId)} onClick={() => startEdit(record)} size="icon" type="button" variant="ghost">
                        <Pencil className="h-4 w-4" strokeWidth={1.5} />
                      </Button>
                      <Button aria-label={`Delete ${titleText}`} className="text-black hover:bg-black hover:text-white" disabled={Boolean(busyId)} onClick={() => deleteRecord(record)} size="icon" type="button" variant="ghost">
                        <Trash2 className="h-5 w-5" strokeWidth={2} />
                      </Button>
                    </div>
                  </div>
                )}
              </article>
            );
          })
        )}
      </div>

      {canFilterRecurring && pageCount > 1 && (
        <div className="mt-5 flex items-center justify-center gap-2">
          {currentPage > 1 && (
            <Button
              aria-label="Previous page"
              className="min-h-10 min-w-10 px-3"
              onClick={() => setCurrentPage(currentPage - 1)}
              type="button"
              variant="ghost"
            >
              {"<"}
            </Button>
          )}
          <div className="flex min-h-10 min-w-10 items-center justify-center border-2 border-black px-3 text-sm font-semibold">
            {currentPage}
          </div>
          {currentPage < pageCount && (
            <Button
              aria-label="Next page"
              className="min-h-10 min-w-10 px-3"
              onClick={() => setCurrentPage(currentPage + 1)}
              type="button"
              variant="ghost"
            >
              {">"}
            </Button>
          )}
        </div>
      )}
    </section>
  );
}

export default function ManageRecords({
  expenseMode,
  expenseRecords,
  focusTarget = "",
  currency = "HKD",
  incomeRecords,
  onChanged,
  t,
}) {
  return (
    <div className="space-y-6">
      <ManageTable
        focusOnMount={focusTarget === "income"}
        currency={currency}
        records={incomeRecords}
        title={t.manageIncome}
        type="income"
        onChanged={onChanged}
        t={t}
      />
      <ManageTable
        focusOnMount={focusTarget === "expense"}
        currency={currency}
        records={expenseRecords}
        title={t.manageExpenses}
        type="expense"
        onChanged={onChanged}
        t={t}
      />
    </div>
  );
}
