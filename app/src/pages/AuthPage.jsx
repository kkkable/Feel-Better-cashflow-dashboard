import { useEffect, useRef, useState } from "react";
import { LockKeyhole, LogIn, UserRound } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import {
  canAttemptRegistration,
  getErrorMessage,
  requiresEmailVerification,
} from "@/lib/authFlow";

const REMEMBERED_ACCOUNT_KEY = "finance-dashboard-account";
const OTP_RESEND_COOLDOWN_SECONDS = 30;

function normalizeEmail(value) {
  return value.trim().toLowerCase();
}

function getRememberedEmail() {
  const remembered = localStorage.getItem(REMEMBERED_ACCOUNT_KEY) || "";
  return remembered.includes("@") ? remembered : "";
}

export default function AuthPage({
  hasGuestData = false,
  isGuestSession = false,
  onAuthenticated,
  onVisitAsGuest,
}) {
  const [account, setAccount] = useState(
    () => getRememberedEmail(),
  );
  const [password, setPassword] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [needsVerification, setNeedsVerification] = useState(false);
  const [rememberAccount, setRememberAccount] = useState(
    () => Boolean(localStorage.getItem(REMEMBERED_ACCOUNT_KEY)),
  );
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGuestPromptOpen, setIsGuestPromptOpen] = useState(false);
  const [registeredThisSession, setRegisteredThisSession] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const guestPromptRef = useRef(null);

  const normalizedEmail = normalizeEmail(account);

  function rememberIfNeeded() {
    if (rememberAccount) {
      localStorage.setItem(REMEMBERED_ACCOUNT_KEY, normalizedEmail);
    } else {
      localStorage.removeItem(REMEMBERED_ACCOUNT_KEY);
    }
  }

  useEffect(() => {
    if (!isGuestPromptOpen) return undefined;

    const handlePointerDown = (event) => {
      if (guestPromptRef.current?.contains(event.target)) return;
      setIsGuestPromptOpen(false);
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
    };
  }, [isGuestPromptOpen]);

  useEffect(() => {
    if (resendCooldown <= 0) return undefined;

    const timeoutId = window.setTimeout(() => {
      setResendCooldown((currentCooldown) => Math.max(0, currentCooldown - 1));
    }, 1000);

    return () => window.clearTimeout(timeoutId);
  }, [resendCooldown]);

  async function login({ migrateGuestData = false } = {}) {
    const response = await base44.auth.loginViaEmailPassword(normalizedEmail, password);
    rememberIfNeeded();
    await onAuthenticated(response.user, { migrateGuestData });
  }

  async function handleContinue(event) {
    event.preventDefault();
    setError("");
    setMessage("");

    if (!normalizedEmail || !password) {
      setError("Email and password are required.");
      return;
    }

    if (!normalizedEmail.includes("@")) {
      setError("Enter a valid email address.");
      return;
    }

    setIsSubmitting(true);
    try {
      try {
        await login();
        return;
      } catch (loginError) {
        if (requiresEmailVerification(loginError)) {
          setNeedsVerification(true);
          setMessage("Enter the verification code sent to your email.");
          return;
        }

        if (!canAttemptRegistration(loginError)) {
          throw loginError;
        }
      }

      await base44.auth.register({
        email: normalizedEmail,
        password,
      });
      rememberIfNeeded();
      setRegisteredThisSession(true);
      setNeedsVerification(true);
      setResendCooldown(OTP_RESEND_COOLDOWN_SECONDS);
      setMessage("Account created. Enter the verification code sent to your email.");
    } catch (continueError) {
      setError(getErrorMessage(continueError, "Unable to login or register."));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleVerify(event) {
    event.preventDefault();
    setError("");
    setMessage("");

    if (!otpCode.trim()) {
      setError("Verification code is required.");
      return;
    }

    setIsSubmitting(true);
    try {
      await base44.auth.verifyOtp({
        email: normalizedEmail,
        otpCode: otpCode.trim(),
      });
      await login({
        migrateGuestData: isGuestSession && registeredThisSession,
      });
    } catch (verifyError) {
      setError(getErrorMessage(verifyError, "Verification failed."));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleResendOtp() {
    setError("");
    setMessage("");

    if (!normalizedEmail) {
      setError("Email is required.");
      return;
    }

    setIsSubmitting(true);
    try {
      await base44.auth.resendOtp(normalizedEmail);
      setResendCooldown(OTP_RESEND_COOLDOWN_SECONDS);
      setMessage("Verification code sent again. Check your email.");
    } catch (resendError) {
      setError(getErrorMessage(resendError, "Unable to resend verification code."));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="finance-page px-4 py-8 sm:px-6">
      <div className="mx-auto flex min-h-[80vh] max-w-md items-center">
        <section className="finance-panel w-full p-6">
          <div className="mb-6 flex items-center gap-3">
            <span className="border-2 border-black bg-black p-2 text-white">
              <LockKeyhole className="h-5 w-5" strokeWidth={1.5} />
            </span>
            <div>
              <h1 className="finance-card-title">Finance account</h1>
              <p className="finance-muted mt-1">Login or register with email and password.</p>
            </div>
          </div>

          <form
            className="space-y-4"
            onSubmit={needsVerification ? handleVerify : handleContinue}
          >
            <label className="finance-label block">
              Email
              <input
                autoComplete="email"
                className="finance-input mt-1"
                onChange={(event) => {
                  setAccount(normalizeEmail(event.target.value));
                  setNeedsVerification(false);
                  setOtpCode("");
                  setRegisteredThisSession(false);
                  setResendCooldown(0);
                }}
                placeholder="you@example.com"
                required
                type="email"
                value={account}
              />
            </label>

            {!needsVerification && (
              <label className="finance-label block">
                Password
                <input
                  autoComplete="current-password"
                  className="finance-input mt-1"
                  onChange={(event) => {
                    setPassword(event.target.value);
                    setRegisteredThisSession(false);
                  }}
                  required
                  type="password"
                  value={password}
                />
              </label>
            )}

            {needsVerification && (
              <label className="finance-label block">
                Verification code
                <input
                  className="finance-input mt-1"
                  onChange={(event) => setOtpCode(event.target.value)}
                  required
                  value={otpCode}
                />
              </label>
            )}

            {needsVerification && (
              <Button
                className="mx-auto flex min-h-8 w-auto px-3 py-1 text-[10px]"
                disabled={isSubmitting || resendCooldown > 0}
                onClick={handleResendOtp}
                type="button"
                variant="ghost"
              >
                {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Resend code"}
              </Button>
            )}

            <label className="finance-label flex items-center gap-2">
              <input
                checked={rememberAccount}
                className="h-5 w-5 border-2 border-black"
                onChange={(event) => setRememberAccount(event.target.checked)}
                type="checkbox"
              />
              Remember email
            </label>

            {message && <p className="finance-status">{message}</p>}
            {error && <p className="finance-error">{error}</p>}

            <Button className="w-full gap-2" disabled={isSubmitting} type="submit">
              <LogIn className="h-4 w-4" strokeWidth={1.5} />
              {isSubmitting
                ? "Working..."
                : needsVerification
                  ? "Verify and login"
                  : "Continue"}
            </Button>
          </form>

          {onVisitAsGuest && (
            <div className="relative mt-4" ref={guestPromptRef}>
              <Button
                className="w-full gap-2"
                disabled={isSubmitting}
                onClick={() => setIsGuestPromptOpen(true)}
                type="button"
                variant="ghost"
              >
                <UserRound className="h-4 w-4" strokeWidth={1.5} />
                {isGuestSession ? "Back to Guest" : "Visit as Guest"}
              </Button>

              {isGuestPromptOpen && (
                <div className="absolute left-1/2 top-full z-10 mt-3 w-full max-w-xs -translate-x-1/2 border-2 border-black bg-white p-4 text-center shadow-[4px_4px_0_#000]">
                  <span
                    aria-hidden="true"
                    className="absolute -top-2 left-1/2 h-4 w-4 -translate-x-1/2 rotate-45 border-l-2 border-t-2 border-black bg-white"
                  />
                  <p className="text-sm font-semibold leading-6">
                    Your data will not be saved as a Guest
                  </p>
                  {hasGuestData && (
                    <p className="finance-muted mt-2 text-xs">
                      Register a new account to keep what you entered.
                    </p>
                  )}
                  <Button
                    className="mx-auto mt-4 h-9 px-5"
                    onClick={() => {
                      setIsGuestPromptOpen(false);
                      onVisitAsGuest();
                    }}
                    type="button"
                  >
                    Understand
                  </Button>
                </div>
              )}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
