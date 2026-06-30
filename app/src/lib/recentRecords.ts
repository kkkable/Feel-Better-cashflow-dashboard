function getRecordTime(record: Record<string, unknown>) {
  const rawDate = record.date || record.created_date || record.updated_date;
  const timestamp = Date.parse(String(rawDate || ""));
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

export function isMonthlyRecord(record: Record<string, unknown>) {
  const frequency = String(record.recurrence_frequency || "").toLowerCase();
  return record.is_recurring === true || frequency === "monthly";
}

export function getNonMonthlyRecords<T extends Record<string, unknown>>(records: T[]) {
  return (Array.isArray(records) ? records : [])
    .filter((record) => !isMonthlyRecord(record))
    .slice()
    .sort((left, right) => getRecordTime(right) - getRecordTime(left));
}

export function getRecentNonMonthlyRecords<T extends Record<string, unknown>>(records: T[], limit = 3) {
  return getNonMonthlyRecords(records).slice(0, limit);
}
