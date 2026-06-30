type IncomeRecord = {
  amount_hkd?: number;
  date?: string;
  is_recurring?: boolean;
  recurrence_frequency?: string;
};

type ExpenseBucket = {
  planned_monthly_amount_hkd?: number;
  is_active?: boolean;
};

type ExpenseRecord = {
  amount_hkd?: number;
  date?: string;
  is_recurring?: boolean;
  category?: string;
};

type MoneyInput = {
  month: string;
  incomeRecords: IncomeRecord[];
  expenseBuckets: ExpenseBucket[];
  expenseRecords: ExpenseRecord[];
};

function addMonths(month: string, offset: number): string {
  const [year, monthIndex] = month.split("-").map(Number);
  const date = new Date(Date.UTC(year, monthIndex - 1 + offset, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function recordMonth(record: { date?: string }): string {
  return String(record.date || "").slice(0, 7);
}

function amount(value: unknown): number {
  return Number(value || 0);
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function sumAmounts<T>(records: T[], selector: (record: T) => unknown): number {
  return roundMoney(records.reduce((sum, record) => sum + amount(selector(record)), 0));
}

function isMonthlyRecurring(record: IncomeRecord | ExpenseRecord): boolean {
  if (!record.is_recurring) return false;
  return !("recurrence_frequency" in record) || !record.recurrence_frequency || record.recurrence_frequency === "monthly";
}

export function buildThisMonthMetrics(input: MoneyInput) {
  const monthIncomeRecords = input.incomeRecords.filter((record) => recordMonth(record) === input.month);
  const monthExpenseRecords = input.expenseRecords.filter((record) => recordMonth(record) === input.month);
  const incomeHkd = sumAmounts(monthIncomeRecords, (record) => record.amount_hkd);
  const expenseHkd = sumAmounts(monthExpenseRecords, (record) => record.amount_hkd);
  const netCashflowHkd = roundMoney(incomeHkd - expenseHkd);
  const recurringMonthlyIncomeHkd = sumAmounts(
    input.incomeRecords.filter(isMonthlyRecurring),
    (record) => record.amount_hkd,
  );
  const recurringMonthlyExpenseHkd = roundMoney(
    sumAmounts(
      input.expenseRecords.filter(isMonthlyRecurring),
      (record) => record.amount_hkd,
    ),
  );

  return {
    month: input.month,
    incomeHkd,
    expenseHkd,
    netCashflowHkd,
    savingsRate: incomeHkd > 0 ? roundMoney((netCashflowHkd / incomeHkd) * 100) : 0,
    recurringMonthlyIncomeHkd,
    recurringMonthlyExpenseHkd,
  };
}

export function buildLastSixMonthsCashflow(input: {
  endMonth: string;
  incomeRecords: IncomeRecord[];
  expenseRecords: ExpenseRecord[];
}) {
  return Array.from({ length: 6 }, (_, index) => {
    const month = addMonths(input.endMonth, index - 5);
    const incomeHkd = sumAmounts(
      input.incomeRecords.filter((record) => recordMonth(record) === month),
      (record) => record.amount_hkd,
    );
    const expenseHkd = sumAmounts(
      input.expenseRecords.filter((record) => recordMonth(record) === month),
      (record) => record.amount_hkd,
    );

    return {
      month,
      incomeHkd,
      expenseHkd,
      netCashflowHkd: roundMoney(incomeHkd - expenseHkd),
    };
  });
}

export function buildCategoryBreakdown(input: {
  month: string;
  expenseRecords: ExpenseRecord[];
}) {
  const totals = new Map<string, number>();

  input.expenseRecords
    .filter((record) => recordMonth(record) === input.month)
    .forEach((record) => {
      const category = record.category || "other";
      totals.set(category, roundMoney((totals.get(category) || 0) + amount(record.amount_hkd)));
    });

  return Array.from(totals.entries())
    .map(([category, amountHkd]) => ({ category, amountHkd }))
    .sort((left, right) => right.amountHkd - left.amountHkd);
}

export function buildRecurringMix(input: MoneyInput) {
  const recurringMonthlyIncomeHkd = sumAmounts(
    input.incomeRecords.filter(isMonthlyRecurring),
    (record) => record.amount_hkd,
  );
  const oneTimeIncomeHkd = sumAmounts(
    input.incomeRecords.filter((record) => !record.is_recurring && recordMonth(record) === input.month),
    (record) => record.amount_hkd,
  );
  const recurringMonthlyExpenseHkd = roundMoney(
    sumAmounts(
      input.expenseRecords.filter(isMonthlyRecurring),
      (record) => record.amount_hkd,
    ),
  );
  const oneTimeExpenseHkd = sumAmounts(
    input.expenseRecords.filter((record) => !record.is_recurring && recordMonth(record) === input.month),
    (record) => record.amount_hkd,
  );

  return {
    income: {
      recurringHkd: recurringMonthlyIncomeHkd,
      oneTimeHkd: oneTimeIncomeHkd,
    },
    expenses: {
      recurringHkd: recurringMonthlyExpenseHkd,
      oneTimeHkd: oneTimeExpenseHkd,
    },
  };
}
