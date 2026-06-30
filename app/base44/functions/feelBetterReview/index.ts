import { createClientFromRequest } from "npm:@base44/sdk";

type FeelBetterRequest = {
  currency?: unknown;
  guest_session_token?: unknown;
  issue_guest_session?: unknown;
  monthly_income_expected?: unknown;
  monthly_expense_expected?: unknown;
  language?: unknown;
};

type ReviewFacts = {
  income: number;
  expense: number;
  leftover: number;
  savingsRate: number;
  mood: "danger" | "tight" | "steady" | "comfortable";
  moodLabel: string;
};

type GeneratedReview = {
  title: string;
  comment: string;
};

type AuthenticatedUser = {
  id?: unknown;
  email?: unknown;
};

type GuestAiSession = {
  expires_at: string;
  id: string;
  ip_hash: string;
  issued_at: string;
  version: 1;
};

const DEFAULT_MODEL = "google/gemma-3-4b-it:cheapest";
const MAX_TITLE_LENGTH = 80;
const MAX_COMMENT_LENGTH = 480;
const HF_MAX_TOKENS = 150;
const HF_AUTH_RATE_LIMIT_WINDOW_MS = 60_000;
const HF_AUTH_RATE_LIMIT_MAX_REQUESTS = 5;
const HF_GUEST_RATE_LIMIT_WINDOW_MS = 60 * 60_000;
const HF_GUEST_RATE_LIMIT_MAX_REQUESTS = 2;
const HF_GUEST_SESSION_TTL_MS = 12 * 60 * 60_000;
const HF_GUEST_SESSION_ISSUE_WINDOW_MS = 60 * 60_000;
const HF_GUEST_SESSION_ISSUE_MAX_REQUESTS = 5;
const CREDIT_SLEEP_COMMENT = "I'm sleeping now. Not gonna work.";
const SUPPORTED_CURRENCIES = new Set(["HKD", "USD", "JPY", "EUR", "GBP", "CNY", "TWD", "SGD", "AUD", "CAD"]);
const CURRENCY_CONTEXTS: Record<string, string> = {
  HKD: "Hong Kong",
  USD: "United States",
  JPY: "Japan",
  EUR: "Eurozone and Europe",
  GBP: "United Kingdom",
  CNY: "Mainland China",
  TWD: "Taiwan",
  SGD: "Singapore",
  AUD: "Australia",
  CAD: "Canada",
};

const huggingFaceRateLimits = new Map<string, { windowStart: number; count: number }>();
const guestSessionIssueLimits = new Map<string, { windowStart: number; count: number }>();
const textEncoder = new TextEncoder();

const json = (body: unknown, status = 200) =>
  Response.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  });

function toNumber(value: unknown) {
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value.replace(/,/g, ""));
  return Number.NaN;
}

function normalizeLanguage(value: unknown) {
  return value === "zh-Hant" ? "zh-Hant" : "en";
}

function normalizeCurrency(value: unknown) {
  if (typeof value !== "string") return "HKD";
  const normalized = value.trim().toUpperCase();
  return SUPPORTED_CURRENCIES.has(normalized) ? normalized : "HKD";
}

function getCurrencyContext(currency: string) {
  return CURRENCY_CONTEXTS[currency] || "the selected currency region";
}

function getRateLimitNumber(envName: string, fallback: number) {
  const configuredValue = Number(Deno.env.get(envName));
  return Number.isFinite(configuredValue) && configuredValue > 0
    ? Math.floor(configuredValue)
    : fallback;
}

function getGuestSessionSecret() {
  return (
    Deno.env.get("FEEL_BETTER_GUEST_TOKEN_SECRET") ||
    Deno.env.get("HUGGINGFACE_GUEST_TOKEN_SECRET") ||
    Deno.env.get("HUGGINGFACE_API_TOKEN") ||
    Deno.env.get("HF_TOKEN") ||
    ""
  );
}

function base64UrlEncode(value: Uint8Array | string) {
  const bytes = typeof value === "string" ? textEncoder.encode(value) : value;
  let binary = "";

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlDecode(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  return atob(padded);
}

async function hmacSha256(secret: string, message: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    textEncoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, textEncoder.encode(message));
  return new Uint8Array(signature);
}

async function getIpHash(ip: string, secret: string) {
  return base64UrlEncode(await hmacSha256(secret, `ip:${ip}`));
}

function randomTokenId() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return base64UrlEncode(bytes);
}

function timingSafeEqual(left: string, right: string) {
  const leftBytes = textEncoder.encode(left);
  const rightBytes = textEncoder.encode(right);
  let diff = leftBytes.length ^ rightBytes.length;
  const maxLength = Math.max(leftBytes.length, rightBytes.length);

  for (let index = 0; index < maxLength; index += 1) {
    diff |= (leftBytes[index] || 0) ^ (rightBytes[index] || 0);
  }

  return diff === 0;
}

function getClientIp(req: Request) {
  const forwardedFor = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return (
    forwardedFor ||
    req.headers.get("x-real-ip")?.trim() ||
    req.headers.get("cf-connecting-ip")?.trim() ||
    "unknown"
  );
}

async function getAuthenticatedUser(req: Request): Promise<AuthenticatedUser | null> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || typeof user !== "object") return null;

    const userId = (user as AuthenticatedUser).id;
    const email = (user as AuthenticatedUser).email;

    if (typeof userId === "string" && userId.trim()) return user as AuthenticatedUser;
    if (typeof email === "string" && email.trim()) return user as AuthenticatedUser;
  } catch {
    return null;
  }

  return null;
}

function getAuthenticatedUserKey(user: AuthenticatedUser) {
  if (typeof user.id === "string" && user.id.trim()) return `user:${user.id.trim()}`;
  if (typeof user.email === "string" && user.email.trim()) return `email:${user.email.trim().toLowerCase()}`;
  return "";
}

function getAuthenticatedHuggingFaceRateLimitPolicy(user: AuthenticatedUser) {
  return {
    key: getAuthenticatedUserKey(user),
    maxRequests: getRateLimitNumber("HUGGINGFACE_AUTH_RATE_LIMIT_MAX_REQUESTS", HF_AUTH_RATE_LIMIT_MAX_REQUESTS),
    windowMs: getRateLimitNumber("HUGGINGFACE_AUTH_RATE_LIMIT_WINDOW_MS", HF_AUTH_RATE_LIMIT_WINDOW_MS),
    includeIpBucket: true,
  };
}

function consumeRateLimitBucket(key: string, now: number, maxRequests: number, windowMs: number) {
  const existing = huggingFaceRateLimits.get(key);

  if (!existing || now - existing.windowStart >= windowMs) {
    huggingFaceRateLimits.set(key, { windowStart: now, count: 1 });
    return true;
  }

  if (existing.count >= maxRequests) return false;

  existing.count += 1;
  return true;
}

function cleanupExpiredRateLimitBuckets(now: number, windowMs: number) {
  if (huggingFaceRateLimits.size < 500) return;

  for (const [key, value] of huggingFaceRateLimits.entries()) {
    if (now - value.windowStart >= windowMs) {
      huggingFaceRateLimits.delete(key);
    }
  }
}

function consumeGuestSessionIssueLimit(req: Request) {
  const now = Date.now();
  const windowMs = getRateLimitNumber("HUGGINGFACE_GUEST_SESSION_ISSUE_WINDOW_MS", HF_GUEST_SESSION_ISSUE_WINDOW_MS);
  const maxRequests = getRateLimitNumber("HUGGINGFACE_GUEST_SESSION_ISSUE_MAX_REQUESTS", HF_GUEST_SESSION_ISSUE_MAX_REQUESTS);
  const key = `issue:${getClientIp(req)}`;
  const existing = guestSessionIssueLimits.get(key);

  if (!existing || now - existing.windowStart >= windowMs) {
    guestSessionIssueLimits.set(key, { windowStart: now, count: 1 });
    return true;
  }

  if (existing.count >= maxRequests) return false;

  existing.count += 1;
  return true;
}

async function createGuestAiSessionToken(req: Request) {
  const secret = getGuestSessionSecret();
  if (!secret || !consumeGuestSessionIssueLimit(req)) return null;

  const now = Date.now();
  const ttlMs = getRateLimitNumber("HUGGINGFACE_GUEST_SESSION_TTL_MS", HF_GUEST_SESSION_TTL_MS);
  const payload: GuestAiSession = {
    expires_at: new Date(now + ttlMs).toISOString(),
    id: randomTokenId(),
    ip_hash: await getIpHash(getClientIp(req), secret),
    issued_at: new Date(now).toISOString(),
    version: 1,
  };
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signature = base64UrlEncode(await hmacSha256(secret, encodedPayload));

  return {
    expires_at: payload.expires_at,
    guest_session_token: `${encodedPayload}.${signature}`,
  };
}

async function verifyGuestAiSessionToken(token: unknown, req: Request) {
  if (typeof token !== "string" || !token.trim()) return null;

  const secret = getGuestSessionSecret();
  if (!secret) return null;

  const [encodedPayload, signature, extra] = token.trim().split(".");
  if (!encodedPayload || !signature || extra !== undefined) return null;

  const expectedSignature = base64UrlEncode(await hmacSha256(secret, encodedPayload));
  if (!timingSafeEqual(signature, expectedSignature)) return null;

  let payload: GuestAiSession;

  try {
    payload = JSON.parse(base64UrlDecode(encodedPayload));
  } catch {
    return null;
  }

  if (payload?.version !== 1 || typeof payload.id !== "string" || !payload.id) return null;
  const expiresAt = typeof payload.expires_at === "string" ? Date.parse(payload.expires_at) : Number.NaN;
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) return null;

  const expectedIpHash = await getIpHash(getClientIp(req), secret);
  if (!timingSafeEqual(payload.ip_hash, expectedIpHash)) return null;

  return payload;
}

function consumeHuggingFaceRateLimit({
  key,
  maxRequests,
  windowMs,
  includeIpBucket,
  req,
}: {
  key: string;
  maxRequests: number;
  windowMs: number;
  includeIpBucket: boolean;
  req: Request;
}) {
  if (!key) return false;

  const ipKey = `ip:${getClientIp(req)}`;

  const now = Date.now();
  cleanupExpiredRateLimitBuckets(now, windowMs);

  const primaryBucket = huggingFaceRateLimits.get(key);
  const ipBucket = huggingFaceRateLimits.get(ipKey);
  const primaryBlocked = primaryBucket && now - primaryBucket.windowStart < windowMs && primaryBucket.count >= maxRequests;
  const ipBlocked = ipBucket && now - ipBucket.windowStart < windowMs && ipBucket.count >= maxRequests;

  if (primaryBlocked || (includeIpBucket && ipBlocked)) return false;

  if (!consumeRateLimitBucket(key, now, maxRequests, windowMs)) return false;
  return !includeIpBucket || consumeRateLimitBucket(ipKey, now, maxRequests, windowMs);
}

async function canUseHuggingFaceReview(req: Request, guestSessionToken: unknown) {
  const user = await getAuthenticatedUser(req);
  const guestSession = user ? null : await verifyGuestAiSessionToken(guestSessionToken, req);

  if (!user && !guestSession) return false;

  return consumeHuggingFaceRateLimit({
    ...(guestSession
      ? {
          key: `guest-session:${guestSession.id}`,
          maxRequests: getRateLimitNumber("HUGGINGFACE_GUEST_RATE_LIMIT_MAX_REQUESTS", HF_GUEST_RATE_LIMIT_MAX_REQUESTS),
          windowMs: getRateLimitNumber("HUGGINGFACE_GUEST_RATE_LIMIT_WINDOW_MS", HF_GUEST_RATE_LIMIT_WINDOW_MS),
          includeIpBucket: true,
        }
      : getAuthenticatedHuggingFaceRateLimitPolicy(user)),
    req,
  });
}

function clampComment(value: string) {
  const cleaned = value.replace(/\s+/g, " ").trim();
  return cleaned.length > MAX_COMMENT_LENGTH
    ? `${cleaned.slice(0, MAX_COMMENT_LENGTH - 1).trim()}...`
    : cleaned;
}

function clampTitle(value: string) {
  const cleaned = value.replace(/\s+/g, " ").trim();
  return cleaned.length > MAX_TITLE_LENGTH
    ? cleaned.slice(0, MAX_TITLE_LENGTH).trim()
    : cleaned;
}

function stripCodeFences(value: string) {
  return value
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

function readJsonStringLiteral(value: string, startIndex: number) {
  if (value[startIndex] !== "\"") return "";

  let result = "";
  let isEscaped = false;

  for (let index = startIndex + 1; index < value.length; index += 1) {
    const character = value[index];

    if (isEscaped) {
      if (character === "n") result += "\n";
      else if (character === "r") result += "\r";
      else if (character === "t") result += "\t";
      else result += character;
      isEscaped = false;
      continue;
    }

    if (character === "\\") {
      isEscaped = true;
      continue;
    }

    if (character === "\"") return result;

    result += character;
  }

  return result;
}

function extractJsonStringField(value: string, fieldName: string) {
  const fieldMatch = new RegExp(`"${fieldName}"\\s*:\\s*"`).exec(value);
  if (!fieldMatch) return "";
  return readJsonStringLiteral(value, fieldMatch.index + fieldMatch[0].lastIndexOf("\""));
}

function getFacts(income: number, expense: number, language: "en" | "zh-Hant"): ReviewFacts {
  const leftover = Math.round((income - expense) * 100) / 100;
  const savingsRate = income > 0 ? Math.round((leftover / income) * 1000) / 10 : 0;

  if (leftover < 0) {
    return {
      income,
      expense,
      leftover,
      savingsRate,
      mood: "danger",
      moodLabel: language === "zh-Hant" ? "超支警報" : "Danger Zone",
    };
  }

  if (savingsRate < 10) {
    return {
      income,
      expense,
      leftover,
      savingsRate,
      mood: "tight",
      moodLabel: language === "zh-Hant" ? "有點緊" : "A Bit Tight",
    };
  }

  if (savingsRate < 25) {
    return {
      income,
      expense,
      leftover,
      savingsRate,
      mood: "steady",
      moodLabel: language === "zh-Hant" ? "穩定中" : "Steady",
    };
  }

  return {
    income,
    expense,
    leftover,
    savingsRate,
    mood: "comfortable",
    moodLabel: language === "zh-Hant" ? "有呼吸空間" : "Breathing Room",
  };
}

function localComment(facts: ReviewFacts, language: "en" | "zh-Hant") {
  if (language === "zh-Hant") {
    if (facts.mood === "danger") {
      return "你不是財務世界末日，只是支出暫時跑得比收入快。先找一項最容易減的開支，本月砍掉一點點，讓現金流先停止流鼻血。";
    }
    if (facts.mood === "tight") {
      return "你的錢包不是壞掉，只是正在用省電模式生活。先把一個小習慣降級，例如少一次外賣，讓月底多一點呼吸空間。";
    }
    if (facts.mood === "steady") {
      return "狀態不錯，錢包沒有尖叫，只是在小聲提醒你保持隊形。把多出來的錢先自動分一部分去儲蓄，未來的你會想請你飲奶茶。";
    }
    return "你有不錯的緩衝，財務狀態比星期一早上的你更穩。保持這個節奏，順手設定一個小儲蓄目標，讓好習慣不用靠意志力上班。";
  }

  if (facts.mood === "danger") {
    return "Kinda fucked up, but maybe we can make some changes after a small break. Your expenses are doing parkour over your income, so pick one easy thing to cut first and stop the cashflow bleeding.";
  }
  if (facts.mood === "tight") {
    return "Your wallet is not broken; it is just living in low-battery mode. Downgrade one small habit this month, like one fewer takeaway, and give future-you some breathing room.";
  }
  if (facts.mood === "steady") {
    return "This is decent: your wallet is not screaming, just asking for adult supervision. Auto-save a small slice of the leftover money and let the system do the boring hero work.";
  }
  return "You have breathing room, which is finance-speak for 'your wallet is not sending dramatic texts.' Keep the rhythm and set one small savings target before lifestyle creep finds the doorbell.";
}

function localTitle(facts: ReviewFacts, language: "en" | "zh-Hant") {
  if (language === "zh-Hant") {
    if (facts.mood === "danger") return "\u9322\u5305\u706b\u8b66";
    if (facts.mood === "tight") return "\u9322\u5305\u4f4e\u96fb\u91cf";
    if (facts.mood === "steady") return "\u6210\u5e74\u4eba\u6a21\u5f0f";
    return "\u9322\u5305\u6709\u6c27\u6c23";
  }

  if (facts.mood === "danger") return "Wallet Fire Drill";
  if (facts.mood === "tight") return "Low Battery Wallet";
  if (facts.mood === "steady") return "Adulting Detected";
  return "Breathing Room Era";
}

function localSuggestions(facts: ReviewFacts, language: "en" | "zh-Hant") {
  if (language === "zh-Hant") {
    if (facts.mood === "danger") return ["先把支出壓到收入以下", "找出最大的一項可變開支", "本月暫停一個非必要訂閱"];
    if (facts.mood === "tight") return ["設定每週支出上限", "保留至少 10% 收入作緩衝", "減少一個高頻小開支"];
    if (facts.mood === "steady") return ["自動儲蓄部分剩餘金額", "建立一個月應急金", "檢查固定支出是否可降低"];
    return ["提高儲蓄目標", "開始建立三個月應急金", "把剩餘金額分配到長期目標"];
  }

  if (facts.mood === "danger") return ["Bring expenses below income first", "Find the largest flexible expense", "Pause one non-essential subscription this month"];
  if (facts.mood === "tight") return ["Set a weekly spending ceiling", "Aim for a 10% income buffer", "Reduce one high-frequency small expense"];
  if (facts.mood === "steady") return ["Auto-save part of the leftover cash", "Build a one-month emergency buffer", "Check whether fixed expenses can be lowered"];
  return ["Raise the savings target", "Build toward a three-month emergency fund", "Assign leftover cash to long-term goals"];
}

function buildPrompt(facts: ReviewFacts, language: "en" | "zh-Hant", currency: string) {
  const currencyContext = getCurrencyContext(currency);

  if (language === "zh-Hant") {
    return [
      "你是一個香港個人理財 app 的友善金錢教練。",
      "請根據以下資料，寫最多 3 句短評。",
      "語氣要幽默、溫柔、實用，不要羞辱用戶，不要正式投資建議。",
      `每月預期收入 ${currency} ${facts.income}`,
      `每月預期支出 ${currency} ${facts.expense}`,
      `每月剩餘 ${currency} ${facts.leftover}`,
      `儲蓄率 ${facts.savingsRate}%`,
      `狀態 ${facts.moodLabel}`,
      "只輸出短評，不要列表，不要標題。",
    ].join("\n");
  }

  return [
    "You are a friendly money coach for a personal finance app.",
    "Write a maximum of 3 short sentences.",
    "Be kind, funny, and practical. Use casual adult humor when it fits, but do not shame the user. Do not give formal investment advice.",
    facts.mood === "danger"
      ? "Because expense is higher than income, start with this exact vibe: \"Kinda fucked up, but maybe we can make some changes after a small break.\" Then give one practical next step."
      : "Make the joke sharper and more memorable than normal finance advice, while staying supportive.",
    `Currency: ${currency}`,
    `Currency context: ${currencyContext}`,
    currency === "HKD"
      ? "Use Hong Kong cost-of-living context."
      : "Do not mention Hong Kong or HKD. Use the selected currency's region for cost-of-living and banking context.",
    `Expected monthly income: ${currency} ${facts.income}`,
    `Expected monthly expense: ${currency} ${facts.expense}`,
    `Monthly leftover: ${currency} ${facts.leftover}`,
    `Savings rate: ${facts.savingsRate}%`,
    `Mood: ${facts.moodLabel}`,
    "Return only the short comment. No list. No title.",
  ].join("\n");
}

function isCreditError(status: number, body: string) {
  const normalizedBody = body.toLowerCase();
  return (
    status === 402 ||
    status === 429 ||
    normalizedBody.includes("credit") ||
    normalizedBody.includes("quota") ||
    normalizedBody.includes("billing") ||
    normalizedBody.includes("payment") ||
    normalizedBody.includes("rate limit")
  );
}

function buildStructuredPrompt(facts: ReviewFacts, language: "en" | "zh-Hant", currency: string) {
  const currencyContext = getCurrencyContext(currency);

  return [
    "You are a friendly money coach for a personal finance app.",
    `Write in ${language === "zh-Hant" ? "Traditional Chinese" : "English"}.`,
    "Return strict JSON only with this shape: {\"title\":\"...\",\"comment\":\"...\"}.",
    "Title: 2 to 6 words, surprising, funny, slightly dramatic, no period.",
    "Comment: maximum 3 short sentences.",
    "Be kind, funny, and practical. Use casual adult humor when it fits, but do not shame the user. Do not give formal investment advice.",
    facts.mood === "danger"
      ? "Because expense is higher than income, start with this exact vibe: \"Kinda fucked up, but maybe we can make some changes after a small break.\" Then give one practical next step."
      : "Make the title and joke sharper and more memorable than normal finance advice, while staying supportive.",
    `Currency: ${currency}`,
    `Currency context: ${currencyContext}`,
    currency === "HKD"
      ? "Use Hong Kong cost-of-living context."
      : "Do not mention Hong Kong or HKD. Use the selected currency's region for cost-of-living and banking context.",
    `Expected monthly income: ${currency} ${facts.income}`,
    `Expected monthly expense: ${currency} ${facts.expense}`,
    `Monthly leftover: ${currency} ${facts.leftover}`,
    `Savings rate: ${facts.savingsRate}%`,
    `Mood: ${facts.moodLabel}`,
  ].join("\n");
}

function parseGeneratedReview(text: string, fallbackTitle: string): GeneratedReview | null {
  const cleaned = stripCodeFences(text);
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  const candidate = jsonMatch ? jsonMatch[0] : cleaned;

  try {
    const parsed = JSON.parse(candidate);
    const title = typeof parsed?.title === "string" ? clampTitle(parsed.title) : "";
    const comment = typeof parsed?.comment === "string" ? clampComment(parsed.comment) : "";

    if (comment) {
      return {
        title: title || fallbackTitle,
        comment,
      };
    }
  } catch {
    const title = clampTitle(extractJsonStringField(cleaned, "title"));
    const comment = clampComment(extractJsonStringField(cleaned, "comment"));

    if (comment) {
      return {
        title: title || fallbackTitle,
        comment,
      };
    }
  }

  return null;
}

async function getHuggingFaceReview(facts: ReviewFacts, language: "en" | "zh-Hant", currency: string) {
  if (Deno.env.get("HUGGINGFACE_ENABLED") !== "true") return null;

  const token = Deno.env.get("HUGGINGFACE_API_TOKEN") || Deno.env.get("HF_TOKEN");
  if (!token) return null;

  const model = Deno.env.get("HUGGINGFACE_MODEL") || DEFAULT_MODEL;
  const endpoint =
    Deno.env.get("HUGGINGFACE_INFERENCE_URL") ||
    "https://router.huggingface.co/v1/chat/completions";
  const prompt = buildStructuredPrompt(facts, language, currency);

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
      max_tokens: HF_MAX_TOKENS,
      temperature: 0.8,
      stream: false,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    return isCreditError(response.status, errorBody)
      ? {
          title: "Nap Mode",
          comment: CREDIT_SLEEP_COMMENT,
        }
      : null;
  }

  const data = await response.json();
  const generatedText =
    typeof data?.choices?.[0]?.message?.content === "string"
      ? data.choices[0].message.content
      : typeof data?.choices?.[0]?.text === "string"
        ? data.choices[0].text
        : typeof data?.generated_text === "string"
          ? data.generated_text
          : typeof data === "string"
            ? data
            : "";

  return parseGeneratedReview(generatedText.replace(prompt, ""), localTitle(facts, language));
}

Deno.serve(async (req) => {
  let body: FeelBetterRequest;

  try {
    const parsedBody = await req.json();
    if (!parsedBody || typeof parsedBody !== "object" || Array.isArray(parsedBody)) {
      return json({ error: "Invalid JSON request body." }, 400);
    }
    body = parsedBody;
  } catch {
    return json({ error: "Invalid JSON request body." }, 400);
  }

  if (body.issue_guest_session === true) {
    const guestSession = await createGuestAiSessionToken(req);
    if (!guestSession) {
      return json({ error: "Unable to issue guest AI session." }, 429);
    }
    return json(guestSession);
  }

  const income = toNumber(body.monthly_income_expected);
  const expense = toNumber(body.monthly_expense_expected);
  const language = normalizeLanguage(body.language);
  const currency = normalizeCurrency(body.currency);

  if (!Number.isFinite(income) || !Number.isFinite(expense) || income < 0 || expense < 0) {
    return json({ error: "monthly_income_expected and monthly_expense_expected must be zero or positive." }, 400);
  }

  const facts = getFacts(Math.round(income * 100) / 100, Math.round(expense * 100) / 100, language);
  let source: "huggingface" | "local" = "local";
  let title = localTitle(facts, language);
  let comment = localComment(facts, language);

  try {
    if (await canUseHuggingFaceReview(req, body.guest_session_token)) {
      const hfReview = await getHuggingFaceReview(facts, language, currency);
      if (hfReview) {
        title = hfReview.title;
        comment = hfReview.comment;
        source = "huggingface";
      }
    }
  } catch {
    source = "local";
  }

  return json({
    income_hkd: facts.income,
    expense_hkd: facts.expense,
    leftover_hkd: facts.leftover,
    savings_rate_percent: facts.savingsRate,
    mood: facts.mood,
    mood_label: facts.moodLabel,
    title,
    comment,
    suggestions: localSuggestions(facts, language),
    source,
  });
});
