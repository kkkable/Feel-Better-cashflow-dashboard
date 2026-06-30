export function formatFeelBetterDefaultInput(amount: unknown): string {
  const numericAmount = Number(amount);
  if (!Number.isFinite(numericAmount)) return "";
  return String(Math.round(numericAmount * 100) / 100);
}
