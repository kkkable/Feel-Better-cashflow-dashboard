type Frequency = "none" | "weekly" | "monthly" | "quarterly" | "yearly";

export type ProjectionIncome = {
  amount_hkd: number;
  date: string;
  is_recurring: boolean;
  recurrence_frequency?: Frequency;
};

export type ProjectionBucket = {
  planned_monthly_amount_hkd: number;
  is_active: boolean;
};

export type ProjectionExpense = {
  amount_hkd: number;
  date: string;
  is_recurring: boolean;
};

export type ProjectionInput = {
  months: number;
  startMonth: string;
  includeActualSpending: boolean;
  incomeRecords: ProjectionIncome[];
  expenseBuckets: ProjectionBucket[];
  expenseRecords: ProjectionExpense[];
};

export type MonthlyProjection = {
  month: string;
  projectedIncomeHkd: number;
  projectedExpensesHkd: number;
  projectedCashflowHkd: number;
  projectedBalanceHkd: number;
};

function addMonths(month: string, offset: number): string {
  const [year, monthIndex] = month.split("-").map(Number);
  const date = new Date(Date.UTC(year, monthIndex - 1 + offset, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function recordMonth(record: { date: string }): string {
  return String(record.date || "").slice(0, 7);
}

function validateProjectionInput(input: ProjectionInput): void {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(input.startMonth)) {
    throw new Error("Invalid startMonth");
  }

  if (!Number.isInteger(input.months) || input.months < 0) {
    throw new Error("Invalid projection months");
  }
}

export function buildMonthlyProjection(input: ProjectionInput): MonthlyProjection[] {
  validateProjectionInput(input);

  const recurringIncome = input.incomeRecords
    .filter((record) => record.is_recurring && record.recurrence_frequency === "monthly")
    .reduce((sum, record) => sum + record.amount_hkd, 0);

  const recurringActualExpenses = input.includeActualSpending
    ? input.expenseRecords.filter((record) => record.is_recurring).reduce((sum, record) => sum + record.amount_hkd, 0)
    : 0;

  let projectedBalanceHkd = 0;

  return Array.from({ length: input.months }, (_, index) => {
    const month = addMonths(input.startMonth, index);
    const oneTimeIncome = input.incomeRecords
      .filter((record) => !record.is_recurring && recordMonth(record) === month)
      .reduce((sum, record) => sum + record.amount_hkd, 0);
    const oneTimeExpenses = input.expenseRecords
      .filter((record) => !record.is_recurring && recordMonth(record) === month)
      .reduce((sum, record) => sum + record.amount_hkd, 0);
    const projectedIncomeHkd = roundMoney(recurringIncome + oneTimeIncome);
    const projectedExpensesHkd = roundMoney(recurringActualExpenses + oneTimeExpenses);
    const projectedCashflowHkd = roundMoney(projectedIncomeHkd - projectedExpensesHkd);
    projectedBalanceHkd = roundMoney(projectedBalanceHkd + projectedCashflowHkd);

    return {
      month,
      projectedIncomeHkd,
      projectedExpensesHkd,
      projectedCashflowHkd,
      projectedBalanceHkd
    };
  });
}
