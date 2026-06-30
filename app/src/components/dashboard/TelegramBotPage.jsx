import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, Copy, ExternalLink, MessageCircle, QrCode, RefreshCcw, Trash2 } from "lucide-react";
import QRCode from "qrcode";
import {
  createExpenseRecord,
  createIncomeRecord,
  createSignalConnection,
  createTelegramConnection,
  listQuickCaptureDrafts,
  listSignalConnections,
  listTelegramConnections,
  updateQuickCaptureDraft,
  updateSignalConnection,
  updateTelegramConnection,
} from "@/api/financeApi";
import { Button } from "@/components/ui/button";
import { buildExpenseRecordPayload, buildIncomePayload } from "@/lib/formPayloads";
import { formatMoney } from "@/lib/money";

const BOT_USERNAME = "YOUR_TELEGRAM_BOT_USERNAME";
const SIGNAL_BOT_NUMBER = "YOUR_SIGNAL_BOT_NUMBER";
const INCOME_CATEGORIES = ["salary", "freelance", "investment", "rental", "bonus", "other"];
const EXPENSE_CATEGORIES = ["housing", "food", "transport", "subscriptions", "insurance", "travel", "savings", "investment", "other"];
const CHECKIN_HOURS = Array.from({ length: 24 }, (_, hour) => String(hour).padStart(2, "0"));
const CHECKIN_MINUTES = ["00", "15", "30", "45"];

function generateToken() {
  const bytes = new Uint8Array(18);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function generateSignalCode() {
  const code = crypto.getRandomValues(new Uint32Array(1))[0] % 1000000;
  return String(code).padStart(6, "0");
}

function addHours(date, hours) {
  return new Date(date.getTime() + hours * 60 * 60 * 1000);
}

function addMinutes(date, minutes) {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

function isSignalCode(value) {
  return /^\d{6}$/.test(String(value || ""));
}

function TelegramLogo({ className = "h-4 w-4" }) {
  return (
    <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 24 24">
      <path d="M21 4 3.9 10.8c-1 .4-.9 1.8.2 2.1l4.2 1.2 1.6 4.8c.3.9 1.4 1.1 2 .4l2.3-2.5 4.3 3.1c.8.6 2 .1 2.1-.9L23 5.4c.2-1-.9-1.8-2-1.4Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.8" />
      <path d="m8.4 14.1 8.8-6.2-6.8 8.4" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
    </svg>
  );
}

function SignalLogo({ className = "h-4 w-4" }) {
  return (
    <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 24 24">
      <path d="M12 3.2c-5 0-9 3.6-9 8 0 2.5 1.3 4.8 3.4 6.3l-.7 3.3 3.5-1.8c.9.2 1.8.3 2.8.3 5 0 9-3.6 9-8s-4-8.1-9-8.1Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.8" />
      <path d="M7.8 10.2h8.4M7.8 13.3h5.5" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
    </svg>
  );
}

function normalizeDraft(draft) {
  const recordType = draft.record_type === "income" ? "income" : "expense";

  return {
    record_type: recordType,
    name: draft.name || "",
    category: draft.category || (recordType === "income" ? "salary" : "other"),
    amount_hkd: String(Number(draft.amount_hkd || 0)),
    date: draft.date || new Date().toISOString().slice(0, 10),
    is_recurring: Boolean(draft.is_recurring),
  };
}

function getErrorMessage(error, fallback) {
  return error instanceof Error ? error.message : fallback;
}

function splitTime(value) {
  const [hour = "22", minute = "30"] = String(value || "22:30").split(":");
  return {
    hour: CHECKIN_HOURS.includes(hour) ? hour : "22",
    minute: CHECKIN_MINUTES.includes(minute) ? minute : "30",
  };
}

export { SignalLogo, TelegramLogo };

export default function TelegramBotPage({ accountName, currency = "HKD", isGuest = false, language, onRecordsChanged, t }) {
  const isMountedRef = useRef(false);
  const [connection, setConnection] = useState(null);
  const [signalConnection, setSignalConnection] = useState(null);
  const [selectedPlatform, setSelectedPlatform] = useState("telegram");
  const [drafts, setDrafts] = useState([]);
  const [draftForms, setDraftForms] = useState({});
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isConfirmingSaveAll, setIsConfirmingSaveAll] = useState(false);
  const [saveAllFeedback, setSaveAllFeedback] = useState("");
  const [copyFeedback, setCopyFeedback] = useState("");
  const [error, setError] = useState("");
  const selectedConnection = selectedPlatform === "signal" ? signalConnection : connection;
  const checkinTime = splitTime(selectedConnection?.daily_checkin_time);

  const botUrl = useMemo(() => {
    if (!connection?.connection_token) return `https://t.me/${BOT_USERNAME}`;
    return `https://t.me/${BOT_USERNAME}?start=${encodeURIComponent(connection.connection_token)}`;
  }, [connection?.connection_token]);

  const signalBotUrl = useMemo(
    () => `https://signal.me/#p/${SIGNAL_BOT_NUMBER}`,
    [],
  );

  const selectedQrUrl = selectedPlatform === "signal" ? signalBotUrl : botUrl;

  const pendingDrafts = useMemo(
    () => drafts.filter((draft) => draft.status === "pending"),
    [drafts],
  );
  const isTelegramConnected = connection?.status === "connected";
  const isSignalConnected = signalConnection?.status === "connected";
  const isSelectedConnected = selectedPlatform === "signal" ? isSignalConnected : isTelegramConnected;

  const loadTelegramData = useCallback(async () => {
    if (!isMountedRef.current) return;

    setIsLoading(true);
    setError("");

    try {
      if (isGuest) {
        setConnection(null);
        setSignalConnection(null);
        setDrafts([]);
        setDraftForms({});
        return;
      }

      const [connections, signalConnections, quickDrafts] = await Promise.all([
        listTelegramConnections(),
        listSignalConnections(),
        listQuickCaptureDrafts(),
      ]);

      if (!isMountedRef.current) return;

      let activeConnection = Array.isArray(connections) ? connections[0] : null;

      if (!activeConnection) {
        activeConnection = await createTelegramConnection({
          owner_email: accountName,
          connection_token: generateToken(),
          token_expires_at: addHours(new Date(), 24).toISOString(),
          bot_username: BOT_USERNAME,
          status: "pending",
          daily_checkin_enabled: false,
          daily_checkin_time: "22:30",
        });
      }

      let activeSignalConnection = Array.isArray(signalConnections) ? signalConnections[0] : null;

      if (!activeSignalConnection) {
        activeSignalConnection = await createSignalConnection({
          owner_email: accountName,
          connection_token: generateSignalCode(),
          token_expires_at: addMinutes(new Date(), 10).toISOString(),
          bot_number: SIGNAL_BOT_NUMBER,
          status: "pending",
          daily_checkin_enabled: false,
          daily_checkin_time: "22:30",
        });
      } else if (
        activeSignalConnection.status !== "connected" &&
        (!isSignalCode(activeSignalConnection.connection_token) ||
          String(activeSignalConnection.token_expires_at || "") < new Date().toISOString())
      ) {
        const signalPatch = {
          connection_token: generateSignalCode(),
          token_expires_at: addMinutes(new Date(), 10).toISOString(),
          status: "pending",
        };
        const updatedSignalConnection = await updateSignalConnection(activeSignalConnection.id, signalPatch);
        activeSignalConnection = {
          ...activeSignalConnection,
          ...signalPatch,
          ...(updatedSignalConnection || {}),
        };
      }

      if (!isMountedRef.current) return;

      setConnection(activeConnection);
      setSignalConnection(activeSignalConnection);
      setDrafts(Array.isArray(quickDrafts) ? quickDrafts : []);
      setDraftForms(
        (Array.isArray(quickDrafts) ? quickDrafts : []).reduce((forms, draft) => {
          forms[draft.id] = normalizeDraft(draft);
          return forms;
        }, {}),
      );
    } catch (loadError) {
      if (isMountedRef.current) {
        setError(getErrorMessage(loadError, t.telegramLoadError));
      }
    } finally {
      if (isMountedRef.current) setIsLoading(false);
    }
  }, [accountName, isGuest, t.telegramLoadError]);

  useEffect(() => {
    isMountedRef.current = true;
    loadTelegramData();

    return () => {
      isMountedRef.current = false;
    };
  }, [loadTelegramData]);

  useEffect(() => {
    let isActive = true;

    QRCode.toDataURL(selectedQrUrl, {
      errorCorrectionLevel: "M",
      margin: 1,
      scale: 7,
      color: {
        dark: "#000000",
        light: "#ffffff",
      },
    })
      .then((dataUrl) => {
        if (isActive) setQrDataUrl(dataUrl);
      })
      .catch(() => {
        if (isActive) setQrDataUrl("");
      });

    return () => {
      isActive = false;
    };
  }, [selectedQrUrl]);

  async function refreshQr() {
    if (selectedPlatform === "signal") {
      if (!signalConnection?.id) return;

      setIsSaving(true);
      setError("");

      try {
        const updatedConnection = await updateSignalConnection(signalConnection.id, {
          connection_token: generateSignalCode(),
          token_expires_at: addMinutes(new Date(), 10).toISOString(),
          status: signalConnection.status === "connected" ? "connected" : "pending",
        });
        setSignalConnection((previousConnection) => ({
          ...previousConnection,
          ...(updatedConnection || {}),
        }));
      } catch (refreshError) {
        setError(getErrorMessage(refreshError, t.telegramUnableRefreshQr));
      } finally {
        setIsSaving(false);
      }
      return;
    }

    if (!connection?.id) return;

    setIsSaving(true);
    setError("");

    try {
      const updatedConnection = await updateTelegramConnection(connection.id, {
        connection_token: generateToken(),
        token_expires_at: addHours(new Date(), 24).toISOString(),
        status: connection.status === "connected" ? "connected" : "pending",
      });
      setConnection((previousConnection) => ({
        ...previousConnection,
        ...(updatedConnection || {}),
      }));
    } catch (refreshError) {
      setError(getErrorMessage(refreshError, t.telegramUnableRefreshQr));
    } finally {
      setIsSaving(false);
    }
  }

  async function disconnectTelegram() {
    if (selectedPlatform === "signal") {
      if (!signalConnection?.id) return;

      setIsSaving(true);
      setError("");

      try {
        const updatedConnection = await updateSignalConnection(signalConnection.id, {
          connection_token: generateSignalCode(),
          token_expires_at: addMinutes(new Date(), 10).toISOString(),
          signal_sender: "",
          signal_sender_name: "",
          status: "pending",
          daily_checkin_enabled: false,
        });
        setSignalConnection((previousConnection) => ({
          ...previousConnection,
          ...(updatedConnection || {}),
          signal_sender: "",
          signal_sender_name: "",
          status: "pending",
          daily_checkin_enabled: false,
        }));
      } catch (disconnectError) {
        setError(getErrorMessage(disconnectError, t.telegramUnableDisconnect));
      } finally {
        setIsSaving(false);
      }
      return;
    }

    if (!connection?.id) return;

    setIsSaving(true);
    setError("");

    try {
      const updatedConnection = await updateTelegramConnection(connection.id, {
        connection_token: generateToken(),
        token_expires_at: addHours(new Date(), 24).toISOString(),
        telegram_chat_id: "",
        telegram_user_id: "",
        telegram_username: "",
        status: "pending",
        daily_checkin_enabled: false,
      });
      setConnection((previousConnection) => ({
        ...previousConnection,
        ...(updatedConnection || {}),
        telegram_chat_id: "",
        telegram_user_id: "",
        telegram_username: "",
        status: "pending",
        daily_checkin_enabled: false,
      }));
    } catch (disconnectError) {
      setError(getErrorMessage(disconnectError, t.telegramUnableDisconnect));
    } finally {
      setIsSaving(false);
    }
  }

  async function updateCheckinSettings(patch) {
    if (selectedPlatform === "signal") {
      if (!signalConnection?.id) return;

      setIsSaving(true);
      setError("");

      try {
        const updatedConnection = await updateSignalConnection(signalConnection.id, patch);
        setSignalConnection((previousConnection) => ({
          ...previousConnection,
          ...patch,
          ...(updatedConnection || {}),
        }));
      } catch (saveError) {
        setError(getErrorMessage(saveError, t.telegramUnableSaveSettings));
      } finally {
        setIsSaving(false);
      }
      return;
    }

    if (!connection?.id) return;

    setIsSaving(true);
    setError("");

    try {
      const updatedConnection = await updateTelegramConnection(connection.id, patch);
      setConnection((previousConnection) => ({
        ...previousConnection,
        ...patch,
        ...(updatedConnection || {}),
      }));
    } catch (saveError) {
      setError(getErrorMessage(saveError, t.telegramUnableSaveSettings));
    } finally {
      setIsSaving(false);
    }
  }

  function updateDraftForm(id, patch) {
    setDraftForms((previousForms) => ({
      ...previousForms,
      [id]: {
        ...previousForms[id],
        ...patch,
      },
    }));
  }

  function getDraftForm(draft) {
    return draftForms[draft.id] || normalizeDraft(draft);
  }

  function validateDraftForm(form) {
    const amount = Number(form.amount_hkd);
    return Boolean(form.name.trim() && Number.isFinite(amount) && amount > 0 && form.date);
  }

  async function copySignalConnectionCode() {
    const token = signalConnection?.connection_token || "";
    if (!token) return;

    try {
      await navigator.clipboard.writeText(token);
      setCopyFeedback(t.copied || "Copied");
      window.setTimeout(() => setCopyFeedback(""), 1800);
    } catch {
      setCopyFeedback(t.copyFailed || "Copy failed");
    }
  }

  async function saveDraftRecord(draft, form) {
    const amount = Number(form.amount_hkd);
    const sourceLabel = draft.source === "signal" ? "Signal" : "Telegram";

    if (form.record_type === "income") {
      await createIncomeRecord(buildIncomePayload({
        source: form.name,
        category: INCOME_CATEGORIES.includes(form.category) ? form.category : "other",
        amount,
        date: form.date,
        isRecurring: form.is_recurring,
        notes: `${sourceLabel}: ${draft.raw_text}`,
      }));
    } else {
      await createExpenseRecord(buildExpenseRecordPayload({
        merchant: form.name,
        category: EXPENSE_CATEGORIES.includes(form.category) ? form.category : "other",
        amount,
        date: form.date,
        isRecurring: form.is_recurring,
        notes: `${sourceLabel}: ${draft.raw_text}`,
      }));
    }

    await updateQuickCaptureDraft(draft.id, { status: "confirmed" });
  }

  async function confirmDraft(draft) {
    const form = getDraftForm(draft);

    if (!validateDraftForm(form)) {
      setError(t.telegramDraftInputError);
      return;
    }

    setIsSaving(true);
    setError("");

    try {
      await saveDraftRecord(draft, form);
      await loadTelegramData();
      await onRecordsChanged?.();
    } catch (saveError) {
      setError(getErrorMessage(saveError, t.unableSaveRecord));
    } finally {
      setIsSaving(false);
    }
  }

  async function saveAllDrafts(event) {
    event?.preventDefault?.();
    event?.stopPropagation?.();

    if (isSaving) return;

    const draftEntries = pendingDrafts.map((draft) => ({
      draft,
      form: getDraftForm(draft),
    }));

    if (draftEntries.length === 0) {
      setSaveAllFeedback(t.telegramNoDrafts);
      return;
    }

    if (draftEntries.some(({ form }) => !validateDraftForm(form))) {
      setSaveAllFeedback(t.telegramDraftInputError);
      return;
    }

    setIsSaving(true);
    setError("");
    setSaveAllFeedback(t.saving);

    try {
      for (const { draft, form } of draftEntries) {
        await saveDraftRecord(draft, form);
      }

      setIsConfirmingSaveAll(false);
      setSaveAllFeedback("");
      await loadTelegramData();
      await onRecordsChanged?.();
    } catch (saveError) {
      const message = getErrorMessage(saveError, t.unableSaveRecord);
      setSaveAllFeedback(message);
      setError(message);
    } finally {
      setIsSaving(false);
    }
  }

  async function ignoreDraft(draft) {
    setIsSaving(true);
    setError("");

    try {
      await updateQuickCaptureDraft(draft.id, { status: "ignored" });
      await loadTelegramData();
    } catch (ignoreError) {
      setError(getErrorMessage(ignoreError, t.telegramUnableIgnoreDraft));
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return (
      <section className="finance-panel flex min-h-72 items-center justify-center p-6">
        <p className="finance-muted">{t.loadingDashboardData}</p>
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <div className="grid gap-3 border-b-4 border-black pb-5 lg:grid-cols-[minmax(0,0.35fr)_minmax(0,0.65fr)]">
        <div>
          <p className="finance-label">{t.telegramBot}</p>
          <h2 className="mt-2 flex items-center gap-3 text-4xl font-semibold leading-none">
            {t.connectBot || t.connectTelegramBot}
            <TelegramLogo className="h-9 w-9 shrink-0" />
            <SignalLogo className="h-9 w-9 shrink-0" />
          </h2>
        </div>
        <p className="text-lg leading-7 text-neutral-700 lg:self-end lg:justify-self-end lg:text-right">{t.telegramIntro}</p>
      </div>

      {error && <p className="finance-error">{error}</p>}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,0.42fr)_minmax(0,0.58fr)]">
        <section className="finance-panel relative overflow-hidden p-5" data-tutorial-target="bot-setup">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <p className="finance-label">{t.telegramSetup}</p>
              <div className="mt-2 inline-flex border-2 border-black">
                <button
                  className={`flex min-h-10 items-center gap-2 border-r-2 border-black px-3 text-xs font-semibold uppercase tracking-widest ${selectedPlatform === "telegram" ? "bg-black text-white" : "bg-white text-black"}`}
                  onClick={() => setSelectedPlatform("telegram")}
                  type="button"
                >
                  <TelegramLogo />
                  Telegram
                </button>
                <button
                  className={`flex min-h-10 items-center gap-2 px-3 text-xs font-semibold uppercase tracking-widest ${selectedPlatform === "signal" ? "bg-black text-white" : "bg-white text-black"}`}
                  onClick={() => setSelectedPlatform("signal")}
                  type="button"
                >
                  <SignalLogo />
                  Signal
                </button>
              </div>
            </div>
            {selectedPlatform === "signal" ? <SignalLogo className="h-7 w-7 shrink-0" /> : <TelegramLogo className="h-7 w-7 shrink-0" />}
          </div>

          {isSelectedConnected ? (
            <>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="finance-card-title mt-2">
                    {t.telegramReadyTitlePrefix}
                    <br />
                    {selectedPlatform === "signal" ? (t.signalReadyTitleBot || "F-finance Signal bot!") : t.telegramReadyTitleBot}
                  </h3>
                  <p className="finance-muted mt-2">
                    {selectedPlatform === "signal" ? (t.signalReadyHelp || "Send simple money messages in Signal and review drafts here.") : t.telegramReadyHelp}
                  </p>
                </div>
              </div>

              <div className="mt-5 border-2 border-black p-3">
                <p className="finance-label">{t.status}</p>
                <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xl font-semibold">{t.telegramConnected}</p>
                    {selectedPlatform === "signal" && signalConnection?.signal_sender && (
                      <p className="finance-muted mt-1">{signalConnection.signal_sender_name || signalConnection.signal_sender}</p>
                    )}
                    {selectedPlatform === "telegram" && connection?.telegram_username && (
                      <p className="finance-muted mt-1">@{connection.telegram_username}</p>
                    )}
                  </div>
                  <Button className="min-h-8 px-3 py-1 text-[10px]" disabled={isSaving} onClick={disconnectTelegram} type="button" variant="ghost">
                    {t.disconnect}
                  </Button>
                </div>
              </div>

              <div className="mt-5 grid gap-4 border-t-2 border-black pt-5">
                <label className="finance-label flex items-center gap-3">
                  <input
                    checked={Boolean(selectedConnection?.daily_checkin_enabled)}
                    disabled={isSaving}
                    onChange={(event) => updateCheckinSettings({ daily_checkin_enabled: event.target.checked })}
                    type="checkbox"
                  />
                  {t.telegramDailyCheckin}
                </label>
                <div>
                  <p className="finance-label">{t.telegramCheckinTime}</p>
                  <div className="mt-2 grid grid-cols-2 gap-3">
                    <label className="finance-label">
                      {t.hour}
                      <select
                        className="finance-input mt-1"
                        disabled={isSaving}
                        onChange={(event) => updateCheckinSettings({ daily_checkin_time: `${event.target.value}:${checkinTime.minute}` })}
                        value={checkinTime.hour}
                      >
                        {CHECKIN_HOURS.map((hour) => (
                          <option key={hour} value={hour}>{hour}</option>
                        ))}
                      </select>
                    </label>
                    <label className="finance-label">
                      {t.minute}
                      <select
                        className="finance-input mt-1"
                        disabled={isSaving}
                        onChange={(event) => updateCheckinSettings({ daily_checkin_time: `${checkinTime.hour}:${event.target.value}` })}
                        value={checkinTime.minute}
                      >
                        {CHECKIN_MINUTES.map((minute) => (
                          <option key={minute} value={minute}>{minute}</option>
                        ))}
                      </select>
                    </label>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="finance-card-title mt-2">
                    {selectedPlatform === "signal" ? (t.signalScanQr || "Open Signal bot on your phone") : t.telegramScanQr}
                  </h3>
                </div>
              </div>

              <div className="mt-5 grid gap-5">
                <div className="flex aspect-square w-full max-w-52 items-center justify-center border-2 border-black bg-white p-3">
                  {qrDataUrl ? (
                    <img alt={selectedPlatform === "signal" ? (t.signalQrAlt || "Signal bot QR code") : t.telegramQrAlt} className="h-full w-full object-contain" src={qrDataUrl} />
                  ) : (
                    <QrCode className="h-10 w-10" strokeWidth={1.5} />
                  )}
                </div>

                <div className="space-y-4">
                  {selectedPlatform === "signal" && (
                    <div className="border-2 border-black p-3">
                      <p className="finance-label">{t.connectionCode || "Connection code"}</p>
                      <div className="mt-2 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
                        <code className="block min-w-0 break-all border border-black px-3 py-2 text-lg font-semibold">{signalConnection?.connection_token || ""}</code>
                        <Button className="gap-2 px-3" onClick={copySignalConnectionCode} type="button" variant="ghost">
                          <Copy className="h-4 w-4" strokeWidth={1.5} />
                          {t.copy || "Copy"}
                        </Button>
                      </div>
                      {copyFeedback && <p className="mt-2 text-xs font-semibold text-neutral-700">{copyFeedback}</p>}
                      <p className="finance-muted mt-2">{t.signalCodeHelp || "Send this 6-digit code to the Signal bot within 10 minutes."}</p>
                    </div>
                  )}
                  <ol className="space-y-3 text-sm font-semibold leading-6 text-black">
                    {selectedPlatform === "signal" ? (
                      <>
                        <li>{t.signalStep1 || "1. Scan the QR code and open Signal."}</li>
                        <li>{t.signalStep2 || "2. Send the connection code shown above."}</li>
                      </>
                    ) : (
                      <>
                        <li>{t.telegramStep1}</li>
                        <li>{t.telegramStep2}</li>
                        <li>{t.telegramStep3}</li>
                      </>
                    )}
                  </ol>

                  <div className="grid gap-2 sm:grid-cols-2">
                    <Button className="w-full gap-2 whitespace-normal px-3 text-center" onClick={() => window.open(selectedQrUrl, "_blank", "noopener,noreferrer")} type="button">
                      <ExternalLink className="h-4 w-4" strokeWidth={1.5} />
                      {selectedPlatform === "signal" ? (t.openSignalBot || "Open Signal bot") : t.openTelegramBot}
                    </Button>
                    <Button className="w-full gap-2 px-3" disabled={isSaving} onClick={refreshQr} type="button" variant="ghost">
                      <RefreshCcw className="h-4 w-4" strokeWidth={1.5} />
                      {selectedPlatform === "signal" ? (t.refreshCode || "Refresh code") : t.refreshQr}
                    </Button>
                  </div>

                  <div className="border-2 border-black p-3">
                    <p className="finance-label">{t.status}</p>
                    <p className="mt-2 text-xl font-semibold">
                      {selectedPlatform === "signal" ? (t.signalWaiting || "Waiting for Signal code") : t.telegramWaiting}
                    </p>
                  </div>
                </div>
              </div>
            </>
          )}

          {isGuest && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/70 p-6 backdrop-blur-[3px]">
              <div className="border-2 border-black bg-white px-4 py-3 text-center text-sm font-semibold shadow-[4px_4px_0_#000]">
                {t.telegramGuestLock || "Login or register to connect a bot."}
              </div>
            </div>
          )}
        </section>

        <section className="finance-panel p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="finance-label">{t.telegramHowToUse}</p>
              <h3 className="finance-card-title mt-2">{t.telegramExamplesTitle}</h3>
            </div>
            <MessageCircle className="h-6 w-6 shrink-0" strokeWidth={1.5} />
          </div>

          <div className="mt-5 grid gap-2">
            {[
              "lunch 58",
              "mtr 12 coffee 42",
              "salary 30000",
              "rent 15000 monthly",
              t.telegramSentenceExample1,
              t.telegramSentenceExample2,
            ].filter(Boolean).map((example) => (
              <code className="border border-black px-3 py-2 text-sm font-semibold" key={example}>
                {example}
              </code>
            ))}
          </div>

        </section>
      </div>

      <section className="finance-panel p-5" data-tutorial-target="bot-drafts">
        <div className="flex flex-col gap-3 border-b-2 border-black pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="finance-label">{t.quickCaptureInbox}</p>
            <h3 className="finance-card-title mt-2">{t.telegramDrafts}</h3>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Button
                className="gap-2"
                disabled={isSaving || pendingDrafts.length === 0}
                onClick={() => {
                  setSaveAllFeedback("");
                  setIsConfirmingSaveAll((isConfirming) => !isConfirming);
                }}
                type="button"
              >
                <Check className="h-4 w-4" strokeWidth={1.5} />
                {t.saveAll}
              </Button>
              {isConfirmingSaveAll && (
                <div className="absolute right-0 top-full z-20 mt-3 w-64 border-2 border-black bg-white p-3 shadow-[4px_4px_0_#000]" onClick={(event) => event.stopPropagation()}>
                  <span className="absolute -top-2 right-6 h-3 w-3 rotate-45 border-l-2 border-t-2 border-black bg-white" aria-hidden="true" />
                  <p className="text-sm font-semibold">{t.confirmSaveAll}</p>
                  {saveAllFeedback && <p className="mt-2 text-xs font-semibold text-neutral-700">{saveAllFeedback}</p>}
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <Button className="px-3" disabled={isSaving} onClick={saveAllDrafts} type="button">
                      {t.save}
                    </Button>
                    <Button className="px-3" disabled={isSaving} onClick={() => {
                      setIsConfirmingSaveAll(false);
                      setSaveAllFeedback("");
                    }} type="button" variant="ghost">
                      {t.cancel}
                    </Button>
                  </div>
                </div>
              )}
            </div>
            <Button className="gap-2" disabled={isSaving} onClick={loadTelegramData} type="button" variant="ghost">
              <RefreshCcw className="h-4 w-4" strokeWidth={1.5} />
              {t.refresh}
            </Button>
          </div>
        </div>

        {pendingDrafts.length === 0 ? (
          <div className="flex min-h-40 items-center justify-center text-center">
            <p className="finance-muted">{t.telegramNoDrafts}</p>
          </div>
        ) : (
          <div className="mt-4 grid gap-3">
            {pendingDrafts.map((draft) => {
              const form = draftForms[draft.id] || normalizeDraft(draft);
              const categoryOptions = form.record_type === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

              return (
                <article className="overflow-hidden border-2 border-black p-4" key={draft.id}>
                  <div className="grid min-w-0 gap-3 md:grid-cols-2 xl:grid-cols-[minmax(7rem,0.8fr)_minmax(8.5rem,1fr)_minmax(8rem,0.95fr)_minmax(6.25rem,0.7fr)_minmax(9.5rem,0.95fr)_minmax(6.75rem,0.65fr)]">
                    <label className="finance-label min-w-0">
                      {t.record}
                      <select
                        className="finance-input mt-1 min-w-0"
                        onChange={(event) => updateDraftForm(draft.id, {
                          record_type: event.target.value,
                          category: event.target.value === "income" ? "salary" : "other",
                        })}
                        value={form.record_type}
                      >
                        <option value="expense">{t.expenses}</option>
                        <option value="income">{t.income}</option>
                      </select>
                    </label>
                    <label className="finance-label min-w-0">
                      {t.name}
                      <input
                        className="finance-input mt-1 min-w-0"
                        onChange={(event) => updateDraftForm(draft.id, { name: event.target.value })}
                        value={form.name}
                      />
                    </label>
                    <label className="finance-label min-w-0">
                      {t.category}
                      <select
                        className="finance-input mt-1 min-w-0"
                        onChange={(event) => updateDraftForm(draft.id, { category: event.target.value })}
                        value={form.category}
                      >
                        {categoryOptions.map((category) => (
                          <option key={category} value={category}>{category}</option>
                        ))}
                      </select>
                    </label>
                    <label className="finance-label min-w-0">
                      {t.amountMoney?.(currency) || `${t.amountHkd || "Amount"} ${currency}`}
                      <input
                        className="finance-input mt-1 min-w-0"
                        min="0"
                        onChange={(event) => updateDraftForm(draft.id, { amount_hkd: event.target.value })}
                        step="0.01"
                        type="number"
                        value={form.amount_hkd}
                      />
                    </label>
                    <label className="finance-label min-w-0">
                      {t.date}
                      <input
                        className="finance-input mt-1 min-w-0"
                        onChange={(event) => updateDraftForm(draft.id, { date: event.target.value })}
                        type="date"
                        value={form.date}
                      />
                    </label>
                    <div className="flex min-w-0 flex-col justify-end gap-2">
                      <Button className="w-full gap-2 px-3" disabled={isSaving} onClick={() => confirmDraft(draft)} type="button">
                        <Check className="h-4 w-4" strokeWidth={1.5} />
                        {t.save}
                      </Button>
                      <Button className="w-full gap-2 px-3" disabled={isSaving} onClick={() => ignoreDraft(draft)} type="button" variant="ghost">
                        <Trash2 className="h-4 w-4" strokeWidth={1.5} />
                        {t.ignore}
                      </Button>
                    </div>
                  </div>
                  <label className="finance-label mt-3 flex items-center gap-2">
                    <input
                      checked={Boolean(form.is_recurring)}
                      className="h-5 w-5 border-2 border-black"
                      onChange={(event) => updateDraftForm(draft.id, { is_recurring: event.target.checked })}
                      type="checkbox"
                    />
                    <span>{t.recurringMonthly}</span>
                  </label>
                  <div className="mt-3 flex flex-wrap gap-3 text-sm text-neutral-700">
                    <span>{t.source}: {draft.source === "signal" ? "Signal" : "Telegram"}</span>
                    <span>{t.rawText}: {draft.raw_text}</span>
                    <span>{t.parser}: {draft.parser_source === "huggingface" ? t.huggingFace : t.localRules}</span>
                    <span>{formatMoney(Number(form.amount_hkd || 0), currency)}</span>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </section>
  );
}
