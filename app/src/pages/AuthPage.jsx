import { useEffect, useRef, useState } from "react";
import {
  BarChart3,
  BotMessageSquare,
  LockKeyhole,
  LogIn,
  Repeat2,
  Sparkles,
  UserRound,
} from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import {
  canAttemptRegistration,
  getErrorMessage,
  requiresEmailVerification,
} from "@/lib/authFlow";

const REMEMBERED_ACCOUNT_KEY = "finance-dashboard-account";
const OTP_RESEND_COOLDOWN_SECONDS = 30;

const publicFeatures = [
  {
    icon: BarChart3,
    title: "Cashflow dashboard",
    description: "See income, expense, and net cashflow in one clean view.",
  },
  {
    icon: Repeat2,
    title: "Recurring records",
    description: "Keep monthly income and spending separate from one-time records.",
  },
  {
    icon: BotMessageSquare,
    title: "Telegram / Signal capture",
    description: "Send simple money messages from your phone and review drafts later.",
  },
  {
    icon: Sparkles,
    title: "Feel Better mode",
    description: "Get a short, kind money mood check when you want a quick review.",
  },
];

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

  function showVerificationStep(nextMessage) {
    setNeedsVerification(true);
    setResendCooldown(OTP_RESEND_COOLDOWN_SECONDS);
    setMessage(nextMessage);
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
          showVerificationStep("Enter the verification code sent to your email.");
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
      showVerificationStep("Account created. Enter the verification code sent to your email.");
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
    <main className="finance-page">
      <div className="finance-shell flex min-h-screen items-center py-8 sm:py-10">
        <div className="grid w-full gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(360px,440px)] lg:items-center">
          <section className="max-w-3xl">
            <p className="finance-label">Personal finance</p>
            <h1 className="mt-3 text-5xl font-semibold leading-none tracking-normal text-black sm:text-6xl lg:text-7xl">
              Feel-Better Cashflow Dashboard
            </h1>
            <p className="finance-muted mt-5 max-w-2xl text-base sm:text-lg">
              Track income, expenses, recurring records, and monthly cashflow in a
              simple dashboard. Try it as a guest before creating an account.
            </p>

            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              {publicFeatures.map(({ icon: FeatureIcon, title, description }) => (
                <div
                  className="border border-black bg-white p-4"
                  key={title}
                >
                  <div className="mb-3 flex items-center gap-3">
                    <span className="flex h-9 w-9 items-center justify-center border border-black bg-white">
                      <FeatureIcon className="h-4 w-4" strokeWidth={1.5} />
                    </span>
                    <h2 className="finance-card-title text-base">{title}</h2>
                  </div>
                  <p className="finance-muted text-sm">{description}</p>
                </div>
              ))}
            </div>

            <p className="finance-status mt-6 max-w-2xl">
              Guest mode is temporary. Create an account when you want to keep your
              records.
            </p>
          </section>

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
      </div>
    </main>
  );
}
