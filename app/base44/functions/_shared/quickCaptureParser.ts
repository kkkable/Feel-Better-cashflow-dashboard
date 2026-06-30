export type QuickCaptureRecordType = "income" | "expense" | "unknown";

export type QuickCaptureParsedDraft = {
  raw_text: string;
  record_type: QuickCaptureRecordType;
  name: string;
  category: string;
  amount_hkd: number;
  date: string;
  is_recurring: boolean;
  confidence: number;
};

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
const incomeNaturalLanguagePattern = /\b(receive|received|recieve|receice|sent me|red packet|lai see|refund|reimbursement|rebate|cashback|gift|allowance)\b/i;
const naturalLanguagePattern = /\b(i|i'm|i am|my|me|mom|mother|dad|father|friend|family|bro|brother|sis|sister|buy|bought|paid|pay|spend|spent|sent|receive|received|recieve|receice|get|got|from|with|for|as|and|then|was|were|dollars?|refund|reimbursement|rebate|cashback|subscription|subscriptio|premium|youtube|youtibe)\b/i;
const localOnlyDisqualifierPattern = /\b(i|i'm|i am|my|me|mom|mother|dad|father|friend|family|bro|brother|sis|sister|buy|bought|paid|pay|spend|spent|sent|receive|received|recieve|receice|get|got|from|with|for|as|and|then|was|were|refund|reimbursement|rebate|cashback|red packet|lai see|gift)\b/i;
const amountPattern = /(?:HKD|HK\$|[$＄])?\s*\d+(?:\.\d+)?|\d+(?:\.\d+)?\s*(?:dollars?|hkd)/gi;
const simpleModifierPattern = /^(?:today|yesterday|monthly|recurring)(?:\s+(?:today|yesterday|monthly|recurring))*$/i;

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

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

export function parseQuickCaptureText(text: string, now = new Date()): QuickCaptureParsedDraft[] {
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
      });
    }
  }

  return drafts;
}

export function shouldUseAiFallback(text: string, drafts: QuickCaptureParsedDraft[]) {
  const normalizedText = text.replace(/\s+/g, " ").trim();
  if (!normalizedText) return false;
  return true;
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
