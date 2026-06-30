import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import {
  clearGuestFinanceSession,
  getOrCreateUserSettings,
  hasGuestFinanceData,
  migrateGuestFinanceDataToUser,
  startGuestFinanceSession,
  useUserFinanceSession,
} from "@/api/financeApi";
import AuthPage from "@/pages/AuthPage";
import Dashboard from "@/pages/DashboardClean";
import Onboarding from "@/pages/Onboarding";
import { normalizeCurrency } from "@/lib/money";

const isCompleteSettings = (settings) => {
  if (!settings) return false;

  return (
    normalizeCurrency(settings.base_currency || "") === settings.base_currency &&
    ["simple", "detailed"].includes(settings.expense_mode) &&
    typeof settings.projection_months === "number" &&
    typeof settings.include_actual_spending_in_projection === "boolean" &&
    (!settings.language || ["en", "zh-Hant"].includes(settings.language)) &&
    settings.onboarding_completed === true
  );
};

function getDisplayAccount(user) {
  const email = user?.email || "";
  return email.endsWith("@personal-finance.local")
    ? email.replace("@personal-finance.local", "")
    : email;
}

export default function App() {
  const [user, setUser] = useState(null);
  const [settings, setSettings] = useState(null);
  const [isGuest, setIsGuest] = useState(false);
  const [isGuestAuthOpen, setIsGuestAuthOpen] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [isLoadingSettings, setIsLoadingSettings] = useState(false);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    let isMounted = true;

    const checkAuth = async () => {
      try {
        const currentUser = await base44.auth.me();

        if (isMounted) {
          if (currentUser) {
            useUserFinanceSession();
          }
          setUser(currentUser || null);
        }
      } catch {
        if (isMounted) {
          setUser(null);
        }
      } finally {
        if (isMounted) {
          setIsCheckingAuth(false);
        }
      }
    };

    checkAuth();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    const loadSettings = async () => {
      if (!user) {
        if (isMounted) {
          if (!isGuest) {
            setSettings(null);
          }
          setLoadError("");
          setIsLoadingSettings(false);
        }
        return;
      }

      setIsLoadingSettings(true);

      try {
        const userSettings = await getOrCreateUserSettings();

        if (isMounted) {
          setSettings(userSettings);
          setLoadError("");
        }
      } catch (error) {
        if (isMounted) {
          setLoadError(
            error instanceof Error
              ? error.message
              : "Unable to load finance settings.",
          );
        }
      } finally {
        if (isMounted) {
          setIsLoadingSettings(false);
        }
      }
    };

    loadSettings();

    return () => {
      isMounted = false;
    };
  }, [isGuest, user]);

  useEffect(() => {
    const handleBeforeUnload = (event) => {
      if (!isGuest) return;

      event.preventDefault();
      event.returnValue = "Are you sure to leave? Your data will not be saved as Guest.";
      return event.returnValue;
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [isGuest]);

  const handleAuthenticated = async (authenticatedUser, options = {}) => {
    setIsLoadingSettings(true);
    setLoadError("");

    try {
      if (options.migrateGuestData && isGuest) {
        const migratedSettings = await migrateGuestFinanceDataToUser();
        setSettings(migratedSettings);
      } else {
        if (isGuest) {
          clearGuestFinanceSession();
        } else {
          useUserFinanceSession();
        }
        setSettings(null);
      }

      useUserFinanceSession();
      setIsGuest(false);
      setIsGuestAuthOpen(false);
      setUser(authenticatedUser);
    } catch (error) {
      setLoadError(
        error instanceof Error
          ? error.message
          : "Unable to save guest data to your account.",
      );
    } finally {
      setIsLoadingSettings(false);
    }
  };

  const handleVisitAsGuest = () => {
    const guestSettings = startGuestFinanceSession();
    setUser(null);
    setSettings(guestSettings);
    setIsGuest(true);
    setIsGuestAuthOpen(false);
    setLoadError("");
  };

  const handleGuestLoginRequest = () => {
    setIsGuestAuthOpen(true);
  };

  const handleLogout = () => {
    base44.auth.logout(window.location.href);
  };

  if (isCheckingAuth || isLoadingSettings) {
    return (
      <main className="finance-page px-6 py-10">
        <div className="mx-auto flex min-h-[70vh] max-w-3xl items-center justify-center">
          <div className="text-center">
            <div className="mx-auto mb-4 h-8 w-8 animate-spin border-2 border-black border-t-white" />
            <p className="finance-muted">
              {isCheckingAuth ? "Checking account..." : "Loading finance settings..."}
            </p>
          </div>
        </div>
      </main>
    );
  }

  if (!user && (!isGuest || isGuestAuthOpen)) {
    return (
      <AuthPage
        hasGuestData={isGuest && hasGuestFinanceData()}
        isGuestSession={isGuest}
        onAuthenticated={handleAuthenticated}
        onVisitAsGuest={isGuest ? () => setIsGuestAuthOpen(false) : handleVisitAsGuest}
      />
    );
  }

  if (loadError) {
    return (
      <main className="finance-page px-6 py-10">
        <div className="mx-auto flex min-h-[70vh] max-w-3xl items-center justify-center">
          <section className="finance-panel w-full max-w-md p-6">
            <p className="finance-label">Settings could not load</p>
            <p className="finance-muted mt-2">{loadError}</p>
            <button
              className="mt-5 border-2 border-black bg-black px-4 py-2 text-xs font-semibold uppercase tracking-widest text-white hover:bg-white hover:text-black focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-black"
              onClick={() => window.location.reload()}
              type="button"
            >
              Try again
            </button>
          </section>
        </div>
      </main>
    );
  }

  if (!isCompleteSettings(settings)) {
    return (
      <Onboarding
        initialSettings={settings}
        onComplete={(updatedSettings) => setSettings(updatedSettings)}
      />
    );
  }

  return (
    <Dashboard
      accountName={isGuest ? "Guest" : getDisplayAccount(user)}
      initialSettings={settings}
      isGuest={isGuest}
      onLoginRequest={handleGuestLoginRequest}
      onLogout={handleLogout}
    />
  );
}
