const QUARTER_MINUTES = new Set(["00", "15", "30", "45"]);

export function getHongKongNow(date = new Date()) {
  return new Date(date.getTime() + 8 * 60 * 60 * 1000);
}

export function getDateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function getQuarterHourKey(date: Date) {
  const hour = String(date.getUTCHours()).padStart(2, "0");
  const quarterMinute = Math.floor(date.getUTCMinutes() / 15) * 15;
  return `${hour}:${String(quarterMinute).padStart(2, "0")}`;
}

export function normalizeQuarterCheckinTime(value: unknown, fallback = "22:30") {
  const match = String(value || "").match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return fallback;

  const hour = Number(match[1]);
  const minute = match[2];
  if (!Number.isInteger(hour) || hour < 0 || hour > 23 || !QUARTER_MINUTES.has(minute)) {
    return fallback;
  }

  return `${String(hour).padStart(2, "0")}:${minute}`;
}
