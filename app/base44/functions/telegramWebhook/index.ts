import { createClientFromRequest } from "npm:@base44/sdk";

type QuickCaptureRecordType = "income" | "expense" | "unknown";

type QuickCaptureParsedDraft = {
  raw_text: string;
  record_type: QuickCaptureRecordType;
  name: string;
  category: string;
  amount_hkd: number;
  date: string;
  is_recurring: boolean;
  confidence: number;
  parser_source?: "local" | "huggingface";
};

type TelegramMessage = {
  message_id?: number;
  text?: string;
  chat?: { id?: number | string };
  from?: { id?: number | string; username?: string };
};

type TelegramUpdate = {
  message?: TelegramMessage;
};

const json = (body: unknown, status = 200) =>
  Response.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  });

const incomeKeywords = [
  "salary",
  "payroll",
  "bonus",
  "freelance",
  "income",
  "red packet",
  "lai see",
  "received",
  "receive",
  "recieve",
  "receice",
  "sent me",
  "give me",
  "gives me",
  "mom give",
  "mother give",
  "dad give",
  "father give",
  "refund",
  "reimbursement",
  "rebate",
  "cashback",
  "part time",
  "part-time",
  "side job",
  "allowance",
];
const foodKeywords = ["lunch", "dinner", "breakfast", "coffee", "tea", "food", "restaurant", "mcdonald", "kfc"];
const transportKeywords = ["mtr", "bus", "taxi", "uber", "tram", "transport"];
const housingKeywords = ["rent", "mortgage"];
const subscriptionKeywords = [
  "netflix",
  "spotify",
  "subscription",
  "subscriptio",
  "subscribe",
  "youtube",
  "youtibe",
  "premium",
  "icloud",
  "apple",
  "google",
  "disney",
  "chatgpt",
  "openai",
  "prime",
  "patreon",
];
const DEFAULT_HF_MODEL = "google/gemma-3-4b-it:cheapest";
const incomeNaturalLanguagePattern = /\b(receive|received|recieve|receice|sent me|red packet|lai see|refund|reimbursement|rebate|cashback|gift|allowance)\b/i;
const naturalLanguagePattern = /\b(i|i'm|i am|my|me|mom|mother|dad|father|friend|family|bro|brother|sis|sister|buy|bought|paid|pay|spend|spent|sent|receive|received|recieve|receice|get|got|from|with|for|as|and|then|was|were|dollars?|refund|reimbursement|rebate|cashback|subscription|subscriptio|premium|youtube|youtibe)\b/i;
const localOnlyDisqualifierPattern = /\b(i|i'm|i am|my|me|mom|mother|dad|father|friend|family|bro|brother|sis|sister|buy|bought|paid|pay|spend|spent|sent|receive|received|recieve|receice|get|got|from|with|for|as|and|then|was|were|refund|reimbursement|rebate|cashback|red packet|lai see|gift)\b/i;
const amountPattern = /(?:HKD|HK\$|[$＄])?\s*\d+(?:\.\d+)?|\d+(?:\.\d+)?\s*(?:dollars?|hkd)/gi;
const simpleModifierPattern = /^(?:today|yesterday|monthly|recurring)(?:\s+(?:today|yesterday|monthly|recurring))*$/i;

function normalizeName(value: string) {
  return value
    .replace(/\b(today|yesterday|monthly|recurring)\b/gi, "")
    .replace(/\b(i|i'm|i am|we|we're|we are)\s+(buy|bought|paid|spend|spent|get|got|have|had)\b/gi, "")
    .replace(/\b(a|an|the)\b/gi, "")
    .replace(/\b(with|for|using|by|via|on|at)\s*$/gi, "")
    .replace(/[$＄]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function inferType(label: string): QuickCaptureRecordType {
  const normalized = label.toLowerCase();
  return incomeKeywords.some((keyword) => normalized.includes(keyword)) ? "income" : "expense";
}

function inferCategory(label: string, type: QuickCaptureRecordType) {
  const normalized = label.toLowerCase();

  if (type === "income") {
    if (normalized.includes("bonus")) return "bonus";
    if (normalized.includes("freelance")) return "freelance";
    return "salary";
  }

  if (foodKeywords.some((keyword) => normalized.includes(keyword))) return "food";
  if (transportKeywords.some((keyword) => normalized.includes(keyword))) return "transport";
  if (housingKeywords.some((keyword) => normalized.includes(keyword))) return "housing";
  if (subscriptionKeywords.some((keyword) => normalized.includes(keyword))) return "subscriptions";
  return "other";
}

function inferDate(text: string, now = new Date()) {
  const normalized = text.toLowerCase();

  if (normalized.includes("yesterday")) {
    const date = new Date(now);
    date.setDate(date.getDate() - 1);
    return date.toISOString().slice(0, 10);
  }

  return now.toISOString().slice(0, 10);
}

function parseQuickCaptureText(text: string, now = new Date()): QuickCaptureParsedDraft[] {
  const rawText = text.trim();
  const normalizedText = rawText.replace(/\s+/g, " ").trim();
  if (!normalizedText) return [];

  const chunks = rawText
    .split(/[,;\n]+/)
    .map((chunk) => chunk.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  const candidates = chunks.length > 0 ? chunks : [normalizedText];
  const drafts: QuickCaptureParsedDraft[] = [];

  for (const candidate of candidates) {
    const date = inferDate(candidate, now);
    const isRecurring = /\b(monthly|recurring)\b/i.test(candidate);
    const pairPattern = /([^\d,;]+?)\s+(?:HKD|HK\$|[$＄])?\s*(\d+(?:\.\d+)?)/gi;
    let match: RegExpExecArray | null;
    let matchedAny = false;

    while ((match = pairPattern.exec(candidate)) !== null) {
      matchedAny = true;
      const name = normalizeName(match[1]) || "Telegram record";
      const amount = Number(match[2]);
      if (!Number.isFinite(amount) || amount < 0) continue;

      const recordType = inferType(name);
      drafts.push({
        raw_text: candidate,
        record_type: recordType,
        name,
        category: inferCategory(name, recordType),
        amount_hkd: Math.round(amount * 100) / 100,
        date,
        is_recurring: isRecurring,
        confidence: /\b(buy|bought|paid|spend|spent|get|got|with|for)\b/i.test(candidate) ? 0.65 : name === "Telegram record" ? 0.45 : 0.82,
        parser_source: "local",
      });
    }

    if (!matchedAny) {
      drafts.push({
        raw_text: candidate,
        record_type: "unknown",
        name: "Needs review",
        category: "other",
        amount_hkd: 0,
        date,
        is_recurring: isRecurring,
        confidence: 0.2,
        parser_source: "local",
      });
    }
  }

  return drafts;
}

function shouldUseAiFallback(text: string, drafts: QuickCaptureParsedDraft[]) {
  const normalizedText = text.replace(/\s+/g, " ").trim();
  if (!normalizedText) return false;

  if (
    drafts.length === 0 ||
    drafts.every((draft) => draft.record_type === "unknown" || draft.amount_hkd <= 0)
  ) {
    return true;
  }

  const amountCount = normalizedText.match(amountPattern)?.length || 0;
  const isBasicLocalCapture = isBasicQuickCaptureText(text, drafts);

  if (isBasicLocalCapture) {
    return false;
  }

  if (amountCount > 0) {
    return true;
  }

  const hasNaturalLanguage = naturalLanguagePattern.test(normalizedText);

  if (incomeNaturalLanguagePattern.test(normalizedText) && amountCount > 0) {
    return true;
  }

  if (hasNaturalLanguage && drafts.some((draft) => draft.confidence < 0.7)) {
    return true;
  }

  if (hasNaturalLanguage && amountCount > 1 && !/[,;\n]/.test(text)) {
    return true;
  }

  return false;
}

function isBasicQuickCaptureText(text: string, drafts: QuickCaptureParsedDraft[]) {
  const normalizedText = text.replace(/\s+/g, " ").trim();
  if (!normalizedText || localOnlyDisqualifierPattern.test(normalizedText)) return false;
  if (drafts.length === 0 || drafts.some((draft) => draft.record_type === "unknown" || draft.amount_hkd <= 0)) return false;

  const chunks = text
    .split(/[,;\n]+/)
    .map((chunk) => chunk.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  if (chunks.length === 0) return false;

  return chunks.every((chunk) => {
    const pairPattern = /([^\d,;]+?)\s+(?:HKD|HK\$|[$＄])?\s*(\d+(?:\.\d+)?)(?:\s*(?:hkd|dollars?))?/gi;
    let match: RegExpExecArray | null;
    let lastIndex = 0;
    let matchedAny = false;

    while ((match = pairPattern.exec(chunk)) !== null) {
      const betweenMatches = chunk.slice(lastIndex, match.index).trim();
      if (betweenMatches) return false;
      matchedAny = true;
      lastIndex = pairPattern.lastIndex;
    }

    const tail = chunk.slice(lastIndex).trim();
    return matchedAny && (!tail || simpleModifierPattern.test(tail));
  });
}

function normalizeAiDraft(value: any, rawText: string, now: Date): QuickCaptureParsedDraft | null {
  const rawAmount = getAiField(value, ["amount_hkd", "amountHKD", "amount", "value", "price", "money", "hkd"]);
  const amount = parseAiAmount(rawAmount);
  const rawRecordType = String(getAiField(value, ["record_type", "recordType", "transaction_type", "transactionType", "type", "kind", "direction"])).toLowerCase();
  const recordType = rawRecordType.includes("income") ? "income" : "expense";
  const rawName = getAiField(value, ["name", "source", "merchant", "description", "label", "item", "title", "payer", "payee", "from", "reason"]);
  const name = typeof rawName === "string" ? rawName.trim() : "";
  const rawCategory = getAiField(value, ["category", "type_category", "record_category"]);
  const category = typeof rawCategory === "string" ? rawCategory.trim() : "other";
  const rawDate = getAiField(value, ["date", "record_date", "transaction_date"]);
  const date = typeof rawDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(rawDate)
    ? rawDate
    : now.toISOString().slice(0, 10);
  const rawRecurring = getAiField(value, ["is_recurring", "isRecurring", "recurring", "frequency", "repeat", "recurrence"]);

  if (!name || !Number.isFinite(amount) || amount <= 0) return null;

  return {
    raw_text: rawText,
    record_type: recordType,
    name,
    category: category || "other",
    amount_hkd: Math.round(amount * 100) / 100,
    date,
    is_recurring: rawRecurring === true || /\b(true|yes|monthly|recurring)\b/i.test(String(rawRecurring ?? "")),
    confidence: 0.7,
    parser_source: "huggingface",
  };
}

function normalizeAiKey(value: string) {
  return value.replace(/[^a-z0-9]/gi, "").toLowerCase();
}

function getAiField(value: any, names: string[]) {
  if (!value || typeof value !== "object") return undefined;

  for (const name of names) {
    if (value[name] !== undefined) return value[name];
  }

  const normalizedNames = new Set(names.map(normalizeAiKey));
  const matchedEntry = Object.entries(value).find(([key]) => normalizedNames.has(normalizeAiKey(key)));
  return matchedEntry?.[1];
}

function parseAiAmount(value: any): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value.replace(/[^0-9.-]/g, ""));
  if (value && typeof value === "object") {
    return parseAiAmount(getAiField(value, ["amount_hkd", "amount", "value", "number", "hkd"]));
  }
  return Number.NaN;
}

function isHuggingFaceEnabled() {
  return (Deno.env.get("HUGGINGFACE_ENABLED") || "true").trim().toLowerCase() !== "false";
}

function getGeneratedText(data: any) {
  return typeof data?.choices?.[0]?.message?.content === "string"
    ? data.choices[0].message.content
    : Array.isArray(data?.choices?.[0]?.message?.content)
      ? data.choices[0].message.content
          .map((part: any) => typeof part?.text === "string" ? part.text : typeof part === "string" ? part : "")
          .join("\n")
    : typeof data?.choices?.[0]?.text === "string"
      ? data.choices[0].text
      : typeof data?.generated_text === "string"
        ? data.generated_text
        : typeof data === "string"
          ? data
          : "";
}

function getDraftItemsFromParsedJson(parsed: any) {
  if (Array.isArray(parsed)) return parsed;
  if (Array.isArray(parsed?.records)) return parsed.records;
  if (Array.isArray(parsed?.drafts)) return parsed.drafts;
  if (Array.isArray(parsed?.items)) return parsed.items;
  if (Array.isArray(parsed?.transactions)) return parsed.transactions;
  if (Array.isArray(parsed?.entries)) return parsed.entries;
  if (Array.isArray(parsed?.results)) return parsed.results;
  if (Array.isArray(parsed?.data)) return parsed.data;
  if (parsed?.record && typeof parsed.record === "object") return [parsed.record];
  if (parsed?.transaction && typeof parsed.transaction === "object") return [parsed.transaction];
  if (parsed && typeof parsed === "object") return [parsed];

  return [];
}

function extractJsonSegments(value: string) {
  const segments: string[] = [];
  let startIndex = -1;
  let depth = 0;
  let isString = false;
  let isEscaped = false;

  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];

    if (isString) {
      if (isEscaped) {
        isEscaped = false;
      } else if (character === "\\") {
        isEscaped = true;
      } else if (character === "\"") {
        isString = false;
      }
      continue;
    }

    if (character === "\"") {
      isString = true;
      continue;
    }

    if (character === "{" || character === "[") {
      if (depth === 0) startIndex = index;
      depth += 1;
      continue;
    }

    if ((character === "}" || character === "]") && depth > 0) {
      depth -= 1;
      if (depth === 0 && startIndex >= 0) {
        segments.push(value.slice(startIndex, index + 1));
        startIndex = -1;
      }
    }
  }

  return segments;
}

function parseAiDraftItems(generatedText: string) {
  const cleaned = generatedText
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  try {
    return getDraftItemsFromParsedJson(JSON.parse(cleaned));
  } catch {
    const items: any[] = [];

    for (const segment of extractJsonSegments(cleaned)) {
      try {
        items.push(...getDraftItemsFromParsedJson(JSON.parse(segment)));
      } catch {
        // Ignore malformed segment and keep checking the rest of the response.
      }
    }

    if (items.length > 0) return items;
  }

  return [];
}

async function getHuggingFaceDrafts(text: string, now: Date) {
  if (!isHuggingFaceEnabled()) {
    console.log("telegramWebhook huggingface skipped: disabled");
    return null;
  }

  const token = Deno.env.get("HUGGINGFACE_API_TOKEN") || Deno.env.get("HF_TOKEN");
  if (!token) {
    console.log("telegramWebhook huggingface skipped: missing token");
    return null;
  }

  const model = Deno.env.get("HUGGINGFACE_MODEL") || DEFAULT_HF_MODEL;
  const endpoint =
    Deno.env.get("HUGGINGFACE_INFERENCE_URL") ||
    "https://router.huggingface.co/v1/chat/completions";
  const today = now.toISOString().slice(0, 10);
  const prompt = [
    "Parse a Hong Kong personal finance Telegram message into JSON only.",
    "Return an array. Each item shape:",
    "{\"record_type\":\"expense|income\",\"name\":\"short merchant/source\",\"category\":\"food|transport|housing|subscriptions|insurance|travel|savings|investment|salary|freelance|bonus|other\",\"amount_hkd\":number,\"date\":\"YYYY-MM-DD\",\"is_recurring\":boolean}",
    "Treat red packets, lai see, gifts, refunds, reimbursements, rebates, cashback, and money received from family/friends as income.",
    "Treat mom give me money, family gives me money, part time job, side job, salary, income, refund, rebate, and red packet as income.",
    "Treat paying family/friends, including phrases like paid my bro, as expense unless the user says they received money.",
    "Treat YouTube Premium, Spotify, Netflix, iCloud, subscriptions, and similar recurring services as subscriptions.",
    "Set is_recurring true when the message says monthly, recurring, subscription, premium plan, rent monthly, or salary monthly.",
    "Split mixed messages into separate income and expense records when needed.",
    `Today is ${today}. Currency defaults to HKD.`,
    `Message: ${text}`,
  ].join("\n");

  let response: Response;

  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: prompt }],
        max_tokens: 650,
        temperature: 0.1,
        stream: false,
      }),
    });
  } catch (error) {
    console.log(`telegramWebhook huggingface network error: ${error instanceof Error ? error.message : "unknown"}`);
    return null;
  }

  if (!response.ok) {
    console.log(`telegramWebhook huggingface response not ok: ${response.status}`);
    return null;
  }

  try {
    const data = await response.json();
    const parsed = parseAiDraftItems(getGeneratedText(data));

    const drafts = parsed
      .map((item) => normalizeAiDraft(item, text, now))
      .filter((item): item is QuickCaptureParsedDraft => Boolean(item));

    if (drafts.length === 0) {
      console.log("telegramWebhook huggingface parse produced no drafts");
    }

    return drafts.length > 0 ? drafts : null;
  } catch (error) {
    console.log(`telegramWebhook huggingface parse error: ${error instanceof Error ? error.message : "unknown"}`);
    return null;
  }
}

function requireWebhookSecret(req: Request) {
  const expectedSecret = Deno.env.get("TELEGRAM_WEBHOOK_SECRET");
  if (!expectedSecret) {
    console.log("telegramWebhook rejected: TELEGRAM_WEBHOOK_SECRET is not configured");
    return false;
  }
  return req.headers.get("X-Telegram-Bot-Api-Secret-Token") === expectedSecret;
}

async function sendTelegramMessage(chatId: string, text: string) {
  const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN");
  if (!botToken) return;

  await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
    }),
  });
}

function getStartToken(text: string) {
  const match = /^\/start(?:@\w+)?\s+(.+)$/i.exec(text.trim());
  return match?.[1]?.trim() || "";
}

function normalizeTelegramId(value: unknown) {
  return value === undefined || value === null ? "" : String(value).trim();
}

async function findConnectedConnection(base44: any, chatId: string, userId: string) {
  const directMatches = await base44.asServiceRole.entities.TelegramConnection.filter({
    telegram_chat_id: chatId,
    status: "connected",
  });

  if (directMatches[0]) {
    console.log(`telegramWebhook connected lookup direct chat_suffix=${chatId.slice(-4)}`);
    return directMatches[0];
  }

  const recentConnections = await base44.asServiceRole.entities.TelegramConnection.list("-created_date", 200);
  const fallbackMatch = recentConnections.find((connection: any) => {
    if (connection.status !== "connected") return false;

    const connectionChatId = normalizeTelegramId(connection.telegram_chat_id);
    const connectionUserId = normalizeTelegramId(connection.telegram_user_id);

    return connectionChatId === chatId || (userId && connectionUserId === userId);
  });

  console.log(
    `telegramWebhook connected lookup fallback chat_suffix=${chatId.slice(-4)} connected_count=${
      recentConnections.filter((connection: any) => connection.status === "connected").length
    } found=${Boolean(fallbackMatch)}`,
  );

  return fallbackMatch || null;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return json({ ok: true });
  }

  if (!requireWebhookSecret(req)) {
    return json({ error: "Invalid Telegram webhook secret." }, 401);
  }

  let update: TelegramUpdate;

  try {
    update = await req.json();
  } catch {
    return json({ error: "Invalid Telegram update." }, 400);
  }

  const message = update.message;
  const text = message?.text?.trim() || "";
  const chatId = normalizeTelegramId(message?.chat?.id);
  const userId = normalizeTelegramId(message?.from?.id);

  if (!text || !chatId) {
    return json({ ok: true });
  }

  const base44 = createClientFromRequest(req);
  const now = new Date();
  const nowIso = now.toISOString();
  const startToken = getStartToken(text);

  if (startToken) {
    const matches = await base44.asServiceRole.entities.TelegramConnection.filter({
      connection_token: startToken,
      status: "pending",
    });
    const connection = matches[0];

    if (!connection || String(connection.token_expires_at || "") < nowIso) {
      await sendTelegramMessage(chatId, "This QR code expired. Open the website and generate a fresh Telegram QR code.");
      return json({ ok: true });
    }

    await base44.asServiceRole.entities.TelegramConnection.update(connection.id, {
      telegram_chat_id: chatId,
      telegram_user_id: userId,
      telegram_username: message?.from?.username || "",
      status: "connected",
      last_connected_at: nowIso,
      last_message_at: nowIso,
    });

    await sendTelegramMessage(
      chatId,
      "Connected. Send records like \"lunch 58 mtr 12 coffee 42\" and review drafts in the website.",
    );
    return json({ ok: true });
  }

  const connection = await findConnectedConnection(base44, chatId, userId);

  if (!connection) {
    await sendTelegramMessage(chatId, "Open the website, scan the Telegram QR code, then press Start here.");
    return json({ ok: true });
  }

  let parsedDrafts = await getHuggingFaceDrafts(text, now);

  if (!parsedDrafts) {
    parsedDrafts = parseQuickCaptureText(text, now);
  }

  for (const draft of parsedDrafts) {
    await base44.asServiceRole.entities.QuickCaptureDraft.create({
      ...draft,
      owner_email: connection.owner_email,
      source: "telegram",
      status: "pending",
      parser_source: draft.parser_source || "local",
      telegram_chat_id: chatId,
      telegram_message_id: message?.message_id === undefined ? "" : String(message.message_id),
      notes: draft.confidence < 0.7 ? "Needs review" : "",
    });
  }

  await base44.asServiceRole.entities.TelegramConnection.update(connection.id, {
    last_message_at: nowIso,
  });

  await sendTelegramMessage(
    chatId,
    parsedDrafts.length === 1
      ? "Got 1 draft. Review it in the website before saving."
      : `Got ${parsedDrafts.length} drafts. Review them in the website before saving.`,
  );

  return json({ ok: true });
});
