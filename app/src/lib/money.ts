export const BASE_CURRENCY = "HKD";

export const SUPPORTED_CURRENCIES = [
  "HKD",
  "USD",
  "JPY",
  "EUR",
  "GBP",
  "CNY",
  "TWD",
  "SGD",
  "AUD",
  "CAD"
] as const;

export type SupportedCurrency = (typeof SUPPORTED_CURRENCIES)[number];

export const CURRENCY_SYMBOLS: Record<SupportedCurrency, string> = {
  HKD: "$",
  USD: "$",
  JPY: "\u00a5",
  EUR: "\u20ac",
  GBP: "\u00a3",
  CNY: "\u00a5",
  TWD: "$",
  SGD: "$",
  AUD: "$",
  CAD: "$",
};

export function normalizeCurrency(value: string): string {
  const normalized = value.trim().toUpperCase();
  return SUPPORTED_CURRENCIES.includes(normalized as SupportedCurrency) ? normalized : BASE_CURRENCY;
}

export function convertToHkd(amount: number, rateToHkd: number): number {
  return Math.round(amount * rateToHkd * 100) / 100;
}

export function formatHkd(amount: number): string {
  return formatMoney(amount, BASE_CURRENCY);
}

export function formatMoney(amount: number, currency = BASE_CURRENCY): string {
  const normalizedCurrency = normalizeCurrency(currency);
  const absoluteAmount = Math.abs(amount);
  const formattedNumber = new Intl.NumberFormat("en-HK", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(absoluteAmount);

  return `${amount < 0 ? "-" : ""}${CURRENCY_SYMBOLS[normalizedCurrency as SupportedCurrency]}${formattedNumber}`;
}

export function formatDashboardHkd(amount: number): string {
  return formatDashboardMoney(amount, BASE_CURRENCY);
}

export function formatDashboardMoney(amount: number, currency = BASE_CURRENCY): string {
  return formatMoney(amount, currency);
}
