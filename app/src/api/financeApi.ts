import { base44 } from "@/api/base44Client";

export type ExpenseMode = "simple" | "detailed";
type FinanceSessionMode = "user" | "guest";
type FinanceRecord = Record<string, unknown> & { id: string };

const GUEST_SETTINGS_ID = "guest-settings";

let financeSessionMode: FinanceSessionMode = "user";
let guestIdCounter = 0;
let guestFeelBetterSession: { expiresAt: string; token: string } | null = null;
let guestSettings: FinanceRecord | null = null;
let guestIncomeRecords: FinanceRecord[] = [];
let guestExpenseBuckets: FinanceRecord[] = [];
let guestExpenseRecords: FinanceRecord[] = [];

export type ExchangeRateResult = {
  base_currency: string;
  quote_currency: string;
  rate_date: string;
  rate: number;
  provider: string;
  fetched_at?: string;
};

export type FeelBetterResult = {
  income_hkd: number;
  expense_hkd: number;
  leftover_hkd: number;
  savings_rate_percent: number;
  mood: "danger" | "tight" | "steady" | "comfortable";
  mood_label: string;
  title: string;
  comment: string;
  suggestions: string[];
  source: "huggingface" | "local";
};

type GuestAiSessionResult = {
  expires_at: string;
  guest_session_token: string;
};

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

function nowIso() {
  return new Date().toISOString();
}

function createGuestId(prefix: string) {
  guestIdCounter += 1;
  return `${prefix}-${Date.now()}-${guestIdCounter}`;
}

function createDefaultGuestSettings(): FinanceRecord {
  return {
    active_tutorial_page: "",
    base_currency: "HKD",
    connect_bot_tutorial_step: 0,
    created_date: nowIso(),
    dashboard_tutorial_step: 0,
    expense_mode: "simple",
    feel_better_tutorial_step: 0,
    id: GUEST_SETTINGS_ID,
    include_actual_spending_in_projection: false,
    language: "en",
    onboarding_completed: false,
    projection_months: 6,
    record_tutorial_step: 0,
    tutorial_dismissed: false,
    updated_date: nowIso(),
  };
}

function ensureGuestSettings() {
  if (!guestSettings) {
    guestSettings = createDefaultGuestSettings();
  }
  return guestSettings;
}

function isGuestSession() {
  return financeSessionMode === "guest";
}

function normalizeSort(sort?: string) {
  const field = sort?.replace(/^-/, "") || "created_date";
  const direction = sort?.startsWith("-") ? -1 : 1;
  return { direction, field };
}

function sortRecords(records: FinanceRecord[], sort?: string) {
  const { direction, field } = normalizeSort(sort);
  return [...records].sort((left, right) => {
    const leftValue = left[field] ?? "";
    const rightValue = right[field] ?? "";
    if (leftValue < rightValue) return -1 * direction;
    if (leftValue > rightValue) return 1 * direction;
    return 0;
  });
}

function listGuestRecords(records: FinanceRecord[], sort?: string, limit?: number) {
  const sorted = sortRecords(records, sort);
  return clone(typeof limit === "number" ? sorted.slice(0, limit) : sorted);
}

function createGuestRecord(records: FinanceRecord[], prefix: string, payload: Record<string, unknown>) {
  const timestamp = nowIso();
  const record = {
    ...payload,
    created_date: timestamp,
    id: createGuestId(prefix),
    updated_date: timestamp,
  };
  records.push(record);
  return clone(record);
}

function updateGuestRecord(records: FinanceRecord[], id: string, patch: Record<string, unknown>) {
  const index = records.findIndex((record) => record.id === id);
  if (index < 0) {
    throw new Error("Guest record was not found.");
  }

  records[index] = {
    ...records[index],
    ...patch,
    updated_date: nowIso(),
  };
  return clone(records[index]);
}

function deleteGuestRecord(records: FinanceRecord[], id: string) {
  const index = records.findIndex((record) => record.id === id);
  if (index >= 0) {
    records.splice(index, 1);
  }
  return { id };
}

export function startGuestFinanceSession() {
  financeSessionMode = "guest";
  guestIdCounter = 0;
  guestFeelBetterSession = null;
  guestSettings = createDefaultGuestSettings();
  guestIncomeRecords = [];
  guestExpenseBuckets = [];
  guestExpenseRecords = [];
  return clone(guestSettings);
}

export function clearGuestFinanceSession() {
  financeSessionMode = "user";
  guestIdCounter = 0;
  guestFeelBetterSession = null;
  guestSettings = null;
  guestIncomeRecords = [];
  guestExpenseBuckets = [];
  guestExpenseRecords = [];
}

export function useUserFinanceSession() {
  financeSessionMode = "user";
}

export function getGuestFinanceSettings() {
  return clone(ensureGuestSettings());
}

export function hasGuestFinanceData() {
  return (
    isGuestSession() &&
    (guestIncomeRecords.length > 0 ||
      guestExpenseBuckets.length > 0 ||
      guestExpenseRecords.length > 0)
  );
}

export async function migrateGuestFinanceDataToUser() {
  const settingsSnapshot = clone(ensureGuestSettings());
  const incomeSnapshot = clone(guestIncomeRecords);
  const bucketSnapshot = clone(guestExpenseBuckets);
  const expenseSnapshot = clone(guestExpenseRecords);

  const existingSettings = await base44.entities.UserSettings.list("-created_date", 1);
  let savedSettings;
  const settingsPayload = {
    active_tutorial_page: settingsSnapshot.active_tutorial_page || "",
    base_currency: settingsSnapshot.base_currency || "HKD",
    connect_bot_tutorial_step: Number(settingsSnapshot.connect_bot_tutorial_step || 0),
    dashboard_tutorial_step: Number(settingsSnapshot.dashboard_tutorial_step || 0),
    expense_mode: settingsSnapshot.expense_mode || "simple",
    feel_better_tutorial_step: Number(settingsSnapshot.feel_better_tutorial_step || 0),
    include_actual_spending_in_projection: Boolean(settingsSnapshot.include_actual_spending_in_projection),
    language: settingsSnapshot.language || "en",
    onboarding_completed: settingsSnapshot.onboarding_completed === true,
    projection_months: Number(settingsSnapshot.projection_months || 6),
    record_tutorial_step: Number(settingsSnapshot.record_tutorial_step || 0),
    tutorial_dismissed: settingsSnapshot.tutorial_dismissed === true,
  };

  if (existingSettings.length > 0) {
    savedSettings = await base44.entities.UserSettings.update(existingSettings[0].id, settingsPayload);
  } else {
    savedSettings = await base44.entities.UserSettings.create(settingsPayload);
  }

  await Promise.all([
    ...incomeSnapshot.map(({ id, created_date, updated_date, ...record }) =>
      base44.entities.IncomeRecord.create(record),
    ),
    ...bucketSnapshot.map(({ id, created_date, updated_date, ...record }) =>
      base44.entities.ExpenseBucket.create(record),
    ),
    ...expenseSnapshot.map(({ id, created_date, updated_date, ...record }) =>
      base44.entities.ExpenseRecord.create(record),
    ),
  ]);

  clearGuestFinanceSession();
  return savedSettings;
}

async function unwrapFunctionResult<T>(result: unknown): Promise<T> {
  if (
    typeof Response !== "undefined" &&
    result instanceof Response
  ) {
    const body = await result.json();
    if (!result.ok) {
      throw new Error(
        typeof body?.error === "string" ? body.error : "Backend function failed.",
      );
    }
    return body as T;
  }

  if (result && typeof result === "object" && "data" in result) {
    return (result as { data: T }).data;
  }

  return result as T;
}

function assertFeelBetterResult(value: FeelBetterResult) {
  if (
    !Number.isFinite(value?.leftover_hkd) ||
    !Number.isFinite(value?.savings_rate_percent) ||
    typeof value?.comment !== "string" ||
    typeof value?.title !== "string" ||
    typeof value?.mood_label !== "string"
  ) {
    throw new Error("Invalid Feel Better response.");
  }
}

function hasValidGuestFeelBetterSession() {
  return (
    guestFeelBetterSession &&
    guestFeelBetterSession.token &&
    Date.parse(guestFeelBetterSession.expiresAt) > Date.now() + 60_000
  );
}

async function getGuestFeelBetterSessionToken() {
  if (!isGuestSession()) return "";
  if (hasValidGuestFeelBetterSession()) return guestFeelBetterSession?.token || "";

  let session: GuestAiSessionResult;

  try {
    const result = await base44.functions.invoke("feelBetterReview", {
      issue_guest_session: true,
    });
    session = await unwrapFunctionResult<GuestAiSessionResult>(result);
  } catch {
    return "";
  }

  if (typeof session?.guest_session_token !== "string" || typeof session?.expires_at !== "string") {
    return "";
  }

  guestFeelBetterSession = {
    expiresAt: session.expires_at,
    token: session.guest_session_token,
  };
  return guestFeelBetterSession.token;
}

export async function getExchangeRate(
  baseCurrency: string,
  rateDate: string,
): Promise<ExchangeRateResult> {
  const result = await base44.functions.invoke("getExchangeRate", {
    base_currency: baseCurrency,
    quote_currency: "HKD",
    rate_date: rateDate,
  });

  return unwrapFunctionResult<ExchangeRateResult>(result);
}

export async function getFeelBetterReview({
  currency,
  monthlyIncomeExpected,
  monthlyExpenseExpected,
  language,
}: {
  currency: string;
  monthlyIncomeExpected: number;
  monthlyExpenseExpected: number;
  language: string;
}): Promise<FeelBetterResult> {
  const guestSessionToken = await getGuestFeelBetterSessionToken();
  const result = await base44.functions.invoke("feelBetterReview", {
    currency,
    ...(guestSessionToken ? { guest_session_token: guestSessionToken } : {}),
    monthly_income_expected: monthlyIncomeExpected,
    monthly_expense_expected: monthlyExpenseExpected,
    language,
  });

  const review = await unwrapFunctionResult<FeelBetterResult>(result);
  assertFeelBetterResult(review);
  return review;
}

export function listIncomeRecords() {
  if (isGuestSession()) {
    return Promise.resolve(listGuestRecords(guestIncomeRecords, "-date"));
  }
  return base44.entities.IncomeRecord.list("-date");
}

export function createIncomeRecord(record: Record<string, unknown>) {
  if (isGuestSession()) {
    return Promise.resolve(createGuestRecord(guestIncomeRecords, "guest-income", record));
  }
  return base44.entities.IncomeRecord.create(record);
}

export function updateIncomeRecord(id: string, patch: Record<string, unknown>) {
  if (isGuestSession()) {
    return Promise.resolve(updateGuestRecord(guestIncomeRecords, id, patch));
  }
  return base44.entities.IncomeRecord.update(id, patch);
}

export function deleteIncomeRecord(id: string) {
  if (isGuestSession()) {
    return Promise.resolve(deleteGuestRecord(guestIncomeRecords, id));
  }
  return base44.entities.IncomeRecord.delete(id);
}

export function listExpenseBuckets() {
  if (isGuestSession()) {
    return Promise.resolve(listGuestRecords(guestExpenseBuckets, "category"));
  }
  return base44.entities.ExpenseBucket.list("category");
}

export function createExpenseBucket(bucket: Record<string, unknown>) {
  if (isGuestSession()) {
    return Promise.resolve(createGuestRecord(guestExpenseBuckets, "guest-bucket", bucket));
  }
  return base44.entities.ExpenseBucket.create(bucket);
}

export function updateExpenseBucket(id: string, patch: Record<string, unknown>) {
  if (isGuestSession()) {
    return Promise.resolve(updateGuestRecord(guestExpenseBuckets, id, patch));
  }
  return base44.entities.ExpenseBucket.update(id, patch);
}

export function deleteExpenseBucket(id: string) {
  if (isGuestSession()) {
    return Promise.resolve(deleteGuestRecord(guestExpenseBuckets, id));
  }
  return base44.entities.ExpenseBucket.delete(id);
}

export function listExpenseRecords() {
  if (isGuestSession()) {
    return Promise.resolve(listGuestRecords(guestExpenseRecords, "-date"));
  }
  return base44.entities.ExpenseRecord.list("-date");
}

export function createExpenseRecord(expense: Record<string, unknown>) {
  if (isGuestSession()) {
    return Promise.resolve(createGuestRecord(guestExpenseRecords, "guest-expense", expense));
  }
  return base44.entities.ExpenseRecord.create(expense);
}

export function updateExpenseRecord(id: string, patch: Record<string, unknown>) {
  if (isGuestSession()) {
    return Promise.resolve(updateGuestRecord(guestExpenseRecords, id, patch));
  }
  return base44.entities.ExpenseRecord.update(id, patch);
}

export function deleteExpenseRecord(id: string) {
  if (isGuestSession()) {
    return Promise.resolve(deleteGuestRecord(guestExpenseRecords, id));
  }
  return base44.entities.ExpenseRecord.delete(id);
}

export function listTelegramConnections() {
  if (isGuestSession()) {
    return Promise.resolve([]);
  }
  return base44.entities.TelegramConnection.list("-created_date");
}

export function createTelegramConnection(connection: Record<string, unknown>) {
  if (isGuestSession()) {
    return Promise.reject(new Error("Login or register to connect a bot."));
  }
  return base44.entities.TelegramConnection.create(connection);
}

export function updateTelegramConnection(id: string, patch: Record<string, unknown>) {
  if (isGuestSession()) {
    return Promise.reject(new Error("Login or register to connect a bot."));
  }
  return base44.entities.TelegramConnection.update(id, patch);
}

export function listSignalConnections() {
  if (isGuestSession()) {
    return Promise.resolve([]);
  }
  return base44.entities.SignalConnection.list("-created_date");
}

export function createSignalConnection(connection: Record<string, unknown>) {
  if (isGuestSession()) {
    return Promise.reject(new Error("Login or register to connect a bot."));
  }
  return base44.entities.SignalConnection.create(connection);
}

export function updateSignalConnection(id: string, patch: Record<string, unknown>) {
  if (isGuestSession()) {
    return Promise.reject(new Error("Login or register to connect a bot."));
  }
  return base44.entities.SignalConnection.update(id, patch);
}

export function listQuickCaptureDrafts() {
  if (isGuestSession()) {
    return Promise.resolve([]);
  }
  return base44.entities.QuickCaptureDraft.list("-created_date");
}

export function updateQuickCaptureDraft(id: string, patch: Record<string, unknown>) {
  if (isGuestSession()) {
    return Promise.reject(new Error("Login or register to use bot drafts."));
  }
  return base44.entities.QuickCaptureDraft.update(id, patch);
}

export async function getOrCreateUserSettings() {
  if (isGuestSession()) {
    return getGuestFinanceSettings();
  }

  const existingSettings = await base44.entities.UserSettings.list(
    "-created_date",
    1,
  );

  if (existingSettings.length > 0) {
    return existingSettings[0];
  }

  return base44.entities.UserSettings.create({
    base_currency: "HKD",
    expense_mode: "simple",
    projection_months: 6,
    include_actual_spending_in_projection: false,
    language: "en",
    onboarding_completed: false,
    tutorial_dismissed: false,
    active_tutorial_page: "",
    dashboard_tutorial_step: 0,
    record_tutorial_step: 0,
    connect_bot_tutorial_step: 0,
    feel_better_tutorial_step: 0,
  });
}

export function updateUserSettings(id: string, patch: Record<string, unknown>) {
  if (isGuestSession()) {
    if (id !== GUEST_SETTINGS_ID) {
      return Promise.reject(new Error("Guest settings record was not found."));
    }

    guestSettings = {
      ...ensureGuestSettings(),
      ...patch,
      updated_date: nowIso(),
    };
    return Promise.resolve(clone(guestSettings));
  }

  return base44.entities.UserSettings.update(id, patch);
}
