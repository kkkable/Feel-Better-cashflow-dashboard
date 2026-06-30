import { createClientFromRequest } from "npm:@base44/sdk";

const json = (body: unknown, status = 200) =>
  Response.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  });

function getHongKongNow() {
  return new Date(Date.now() + 8 * 60 * 60 * 1000);
}

function getQuarterHourKey(date: Date) {
  const hour = String(date.getUTCHours()).padStart(2, "0");
  const quarterMinute = Math.floor(date.getUTCMinutes() / 15) * 15;
  return `${hour}:${String(quarterMinute).padStart(2, "0")}`;
}

function getDateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function normalizeQuarterCheckinTime(value: unknown, fallback = "22:30") {
  const match = String(value || "").match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return fallback;

  const hour = Number(match[1]);
  const minute = match[2];
  const quarterMinutes = new Set(["00", "15", "30", "45"]);
  if (!Number.isInteger(hour) || hour < 0 || hour > 23 || !quarterMinutes.has(minute)) {
    return fallback;
  }

  return `${String(hour).padStart(2, "0")}:${minute}`;
}

async function sendTelegramMessage(chatId: string, text: string) {
  const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN");
  if (!botToken) return false;

  const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
    }),
  });

  return response.ok;
}

function requireBridgeSecret(req: Request) {
  const expectedSecret = Deno.env.get("TELEGRAM_CHECKIN_SECRET") || Deno.env.get("SIGNAL_BRIDGE_SECRET");
  if (!expectedSecret) return false;

  return (
    req.headers.get("X-Telegram-Checkin-Secret") === expectedSecret ||
    req.headers.get("X-Signal-Bridge-Secret") === expectedSecret
  );
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return json({ ok: true });
  }

  if (!requireBridgeSecret(req)) {
    return json({ error: "Invalid Telegram check-in secret." }, 401);
  }

  const base44 = createClientFromRequest(req);
  const hkNow = getHongKongNow();
  const currentCheckinTime = getQuarterHourKey(hkNow);
  const today = getDateKey(hkNow);

  const connections = await base44.asServiceRole.entities.TelegramConnection.filter({
    status: "connected",
    daily_checkin_enabled: true,
  });

  let sent = 0;

  for (const connection of connections) {
    const checkinTime = normalizeQuarterCheckinTime(connection.daily_checkin_time || "22:30");

    if (
      !connection.telegram_chat_id ||
      checkinTime !== currentCheckinTime ||
      connection.last_checkin_sent_date === today
    ) {
      continue;
    }

    const ok = await sendTelegramMessage(
      String(connection.telegram_chat_id),
      "Any spending today? Send something like \"lunch 58 mtr 12 coffee 42\".",
    );

    if (ok) {
      sent += 1;
      await base44.asServiceRole.entities.TelegramConnection.update(connection.id, {
        last_checkin_sent_date: today,
      });
    }
  }

  return json({ sent });
});
