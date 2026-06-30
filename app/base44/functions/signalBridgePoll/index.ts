import { createClientFromRequest } from "npm:@base44/sdk";

const json = (body: unknown, status = 200) =>
  Response.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  });

function requireBridgeSecret(req: Request) {
  const expectedSecret = Deno.env.get("SIGNAL_BRIDGE_SECRET");
  if (!expectedSecret) return false;
  return req.headers.get("X-Signal-Bridge-Secret") === expectedSecret;
}

function getHongKongNow() {
  return new Date(Date.now() + 8 * 60 * 60 * 1000);
}

function getHourKey(date: Date) {
  return `${String(date.getUTCHours()).padStart(2, "0")}:00`;
}

function getDateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return json({ ok: true });
  }

  if (!requireBridgeSecret(req)) {
    return json({ error: "Invalid Signal bridge secret." }, 401);
  }

  const base44 = createClientFromRequest(req);
  const hkNow = getHongKongNow();
  const currentHour = getHourKey(hkNow);
  const today = getDateKey(hkNow);

  const connections = await base44.asServiceRole.entities.SignalConnection.filter({
    status: "connected",
    daily_checkin_enabled: true,
  });

  const messages = [];

  for (const connection of connections) {
    const checkinHour = String(connection.daily_checkin_time || "22:30").slice(0, 2).padStart(2, "0") + ":00";

    if (
      !connection.signal_sender ||
      checkinHour !== currentHour ||
      connection.last_checkin_sent_date === today
    ) {
      continue;
    }

    messages.push({
      connection_id: connection.id,
      recipient: String(connection.signal_sender),
      text: "Any spending today? Send something like \"lunch 58 mtr 12 coffee 42\".",
    });

    await base44.asServiceRole.entities.SignalConnection.update(connection.id, {
      last_checkin_sent_date: today,
    });
  }

  return json({ messages });
});
