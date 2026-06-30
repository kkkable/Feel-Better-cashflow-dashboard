export type MoneyWeather = "none" | "sunny" | "cloudy" | "rainy";

type MoneyWeatherInput = {
  hasRecords: boolean;
  currentIncomeHkd: number;
  currentExpenseHkd: number;
  projectedCashflowHkd: number;
};

function toAmount(value: number) {
  return Number.isFinite(value) ? value : 0;
}

export function getMoneyWeather(input: MoneyWeatherInput): MoneyWeather {
  if (!input.hasRecords) return "none";

  const income = toAmount(input.currentIncomeHkd);
  const expense = toAmount(input.currentExpenseHkd);
  const projectedCashflow = toAmount(input.projectedCashflowHkd);

  if (expense > income || projectedCashflow < 0) return "rainy";
  if (income >= expense * 1.2 && projectedCashflow > 0) return "sunny";
  return "cloudy";
}
