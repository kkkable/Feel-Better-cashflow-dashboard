import { describe, expect, it } from "vitest";
import { canAttemptRegistration, requiresEmailVerification } from "./authFlow";

describe("auth flow helpers", () => {
  it("shows verification for unverified login errors", () => {
    expect(requiresEmailVerification({ status: 403 })).toBe(true);
    expect(requiresEmailVerification({ response: { status: 403 } })).toBe(true);
  });

  it("shows verification when the auth message mentions OTP or verification", () => {
    expect(requiresEmailVerification(new Error("Email not verified. Please enter OTP."))).toBe(true);
  });

  it("does not try to register when login failed because email is unverified", () => {
    expect(canAttemptRegistration({ status: 403 })).toBe(false);
  });

  it("tries registration for invalid credentials or missing users", () => {
    expect(canAttemptRegistration({ status: 401 })).toBe(true);
    expect(canAttemptRegistration(new Error("User not found"))).toBe(true);
  });
});
