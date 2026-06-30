export function getErrorMessage(error, fallback = "") {
  return error instanceof Error ? error.message : fallback;
}

export function getErrorStatus(error) {
  return error?.status || error?.response?.status;
}

export function requiresEmailVerification(error) {
  const status = getErrorStatus(error);
  const message = getErrorMessage(error, "").toLowerCase();

  return (
    status === 403 ||
    message.includes("not verified") ||
    message.includes("verification") ||
    message.includes("verify") ||
    message.includes("otp")
  );
}

export function canAttemptRegistration(error) {
  const status = getErrorStatus(error);
  const message = getErrorMessage(error, "").toLowerCase();

  return (
    !requiresEmailVerification(error) &&
    (
      [400, 401, 404].includes(status) ||
      message.includes("invalid") ||
      message.includes("not found") ||
      message.includes("credentials")
    )
  );
}
