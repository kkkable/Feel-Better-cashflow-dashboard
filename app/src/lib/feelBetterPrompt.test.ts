import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("../../base44/functions/feelBetterReview/index.ts", import.meta.url), "utf8");
const financeApiSource = readFileSync(new URL("../api/financeApi.ts", import.meta.url), "utf8");

describe("Feel Better prompt currency context", () => {
  it("maps every supported currency to a practical local context", () => {
    expect(source).toContain('HKD: "Hong Kong"');
    expect(source).toContain('USD: "United States"');
    expect(source).toContain('JPY: "Japan"');
    expect(source).toContain('EUR: "Eurozone and Europe"');
    expect(source).toContain('GBP: "United Kingdom"');
    expect(source).toContain('CNY: "Mainland China"');
    expect(source).toContain('TWD: "Taiwan"');
    expect(source).toContain('SGD: "Singapore"');
    expect(source).toContain('AUD: "Australia"');
    expect(source).toContain('CAD: "Canada"');
  });

  it("prevents non-HKD reviews from falling back to Hong Kong advice", () => {
    expect(source).toContain("Currency context: ${currencyContext}");
    expect(source).toContain("Do not mention Hong Kong or HKD");
    expect(source).toContain("Use the selected currency's region for cost-of-living and banking context.");
    expect(source).not.toContain("You are a friendly money coach for a Hong Kong personal finance app.");
  });
});

describe("Feel Better Hugging Face quota guard", () => {
  it("keeps server-token-backed Hugging Face calls behind backend rate limiting", () => {
    expect(source).toContain('import { createClientFromRequest } from "npm:@base44/sdk";');
    expect(source).toContain("const user = await base44.auth.me();");
    expect(source).toContain("async function canUseHuggingFaceReview(req: Request, guestSessionToken: unknown)");
    expect(source).toContain("function getAuthenticatedHuggingFaceRateLimitPolicy(user: AuthenticatedUser)");
    expect(source).toContain("return consumeHuggingFaceRateLimit({");
    expect(source).toMatch(/if\s*\(\s*await canUseHuggingFaceReview\(req,\s*body\.guest_session_token\)\s*\)\s*\{\s*const hfReview = await getHuggingFaceReview/s);
  });

  it("allows guests only through a signed guest AI session token", () => {
    expect(source).toMatch(/catch\s*\{\s*return null;\s*\}/);
    expect(source).toContain("async function createGuestAiSessionToken(req: Request)");
    expect(source).toContain("async function verifyGuestAiSessionToken(token: unknown, req: Request)");
    expect(source).toContain("guest_session_token");
    expect(source).toContain("if (body.issue_guest_session === true)");
    expect(source).toContain("const guestSession = user ? null : await verifyGuestAiSessionToken(guestSessionToken, req);");
    expect(source).toContain("if (!user && !guestSession) return false;");
    expect(source).toContain("const HF_GUEST_RATE_LIMIT_MAX_REQUESTS = 2;");
    expect(source).toContain("const HF_GUEST_RATE_LIMIT_WINDOW_MS = 60 * 60_000;");
    expect(source).toContain("key: `guest-session:${guestSession.id}`");
    expect(source).toContain('let source: "huggingface" | "local" = "local";');
  });

  it("requests and reuses a guest AI session token from the frontend guest session", () => {
    expect(financeApiSource).toContain("let guestFeelBetterSession");
    expect(financeApiSource).toContain("issue_guest_session: true");
    expect(financeApiSource).toContain("guest_session_token: guestSessionToken");
    expect(financeApiSource).toContain("return \"\";");
  });
});
