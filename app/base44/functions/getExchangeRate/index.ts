import { createClientFromRequest } from "npm:@base44/sdk";

type ExchangeRateRequest = {
  base_currency?: unknown;
  quote_currency?: unknown;
  rate_date?: unknown;
};

const json = (body: unknown, status = 200) =>
  Response.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  });

Deno.serve(async (req) => {
  let body: ExchangeRateRequest;

  try {
    const parsedBody = await req.json();
    if (!parsedBody || typeof parsedBody !== "object" || Array.isArray(parsedBody)) {
      return json({ error: "Invalid JSON request body." }, 400);
    }
    body = parsedBody;
  } catch {
    return json({ error: "Invalid JSON request body." }, 400);
  }

  if (
    typeof body.base_currency !== "string" ||
    typeof body.rate_date !== "string" ||
    (body.quote_currency !== undefined && typeof body.quote_currency !== "string")
  ) {
    return json({ error: "base_currency and rate_date are required." }, 400);
  }

  const baseCurrency = body.base_currency.trim().toUpperCase();
  const quoteCurrency = body.quote_currency?.trim().toUpperCase() || "HKD";
  const rateDate = body.rate_date.trim();

  if (!baseCurrency || !rateDate) {
    return json({ error: "base_currency and rate_date are required." }, 400);
  }

  try {
    if (baseCurrency === quoteCurrency) {
      return json({
        base_currency: baseCurrency,
        quote_currency: quoteCurrency,
        rate_date: rateDate,
        rate: 1,
        provider: "identity",
      });
    }

    const base44 = createClientFromRequest(req);
    let cachedRates;

    try {
      cachedRates = await base44.asServiceRole.entities.ExchangeRateCache.filter({
        base_currency: baseCurrency,
        quote_currency: quoteCurrency,
        rate_date: rateDate,
      });
    } catch {
      return json({ error: "Unable to get exchange rate." }, 500);
    }

    const cachedRate = cachedRates[0];

    if (cachedRate) {
      return json({
        base_currency: cachedRate.base_currency,
        quote_currency: cachedRate.quote_currency,
        rate_date: cachedRate.rate_date,
        rate: cachedRate.rate,
        provider: cachedRate.provider,
        fetched_at: cachedRate.fetched_at,
      });
    }

    const providerUrl = `https://api.frankfurter.app/${encodeURIComponent(rateDate)}?from=${encodeURIComponent(
      baseCurrency,
    )}&to=${encodeURIComponent(quoteCurrency)}`;

    let providerResponse: Response;

    try {
      providerResponse = await fetch(providerUrl);
    } catch {
      return json({ error: "Exchange rate provider request failed." }, 502);
    }

    if (!providerResponse.ok) {
      return json({ error: "Exchange rate provider request failed." }, 502);
    }

    let providerData: { rates?: Record<string, number> };

    try {
      providerData = await providerResponse.json();
    } catch {
      return json({ error: "Exchange rate provider request failed." }, 502);
    }

    const rate = providerData?.rates?.[quoteCurrency];

    if (typeof rate !== "number") {
      return json({ error: "Exchange rate not found." }, 404);
    }

    const fetchedAt = new Date().toISOString();
    const result = {
      base_currency: baseCurrency,
      quote_currency: quoteCurrency,
      rate_date: rateDate,
      rate,
      provider: "frankfurter",
      fetched_at: fetchedAt,
    };

    try {
      await base44.asServiceRole.entities.ExchangeRateCache.create(result);
    } catch {
      return json(result);
    }

    return json(result);
  } catch {
    return json({ error: "Unable to get exchange rate." }, 500);
  }
});
