const HKD_MONEY = {
  currency_original: "HKD",
  exchange_rate_to_hkd: 1,
  rate_source: "fixed",
};

function parseAmount(amount) {
  return Number(amount);
}

export function buildIncomePayload({
  source,
  category = "salary",
  amount,
  date,
  isRecurring = false,
  notes = "",
}) {
  const amountHkd = parseAmount(amount);

  return {
    source: source.trim(),
    category: category.trim() || "salary",
    amount_original: amountHkd,
    ...HKD_MONEY,
    amount_hkd: amountHkd,
    date,
    is_recurring: isRecurring,
    recurrence_frequency: isRecurring ? "monthly" : "none",
    notes: notes.trim(),
  };
}

export function buildExpenseRecordPayload({
  merchant,
  category = "other",
  amount,
  date,
  paymentMethod = "",
  isRecurring = false,
  notes = "",
}) {
  const amountHkd = parseAmount(amount);

  return {
    merchant: merchant.trim(),
    category: category.trim() || "other",
    amount_original: amountHkd,
    ...HKD_MONEY,
    amount_hkd: amountHkd,
    date,
    payment_method: paymentMethod.trim(),
    is_recurring: isRecurring,
    notes: notes.trim(),
  };
}

export function buildExpenseBucketPayload({
  name,
  amount,
  category = "other",
  notes = "",
}) {
  const amountHkd = parseAmount(amount);

  return {
    name: name.trim(),
    category: category.trim() || "other",
    planned_monthly_amount_hkd: amountHkd,
    currency_original: "HKD",
    exchange_rate_to_hkd: 1,
    amount_original: amountHkd,
    is_active: true,
    notes: notes.trim(),
  };
}
