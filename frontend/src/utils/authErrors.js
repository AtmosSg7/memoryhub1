export const AUTH_ERROR_KEY_BY_MESSAGE = {
  "Invalid email or password.": "auth.errors.loginFailed",
  "An account with this email already exists.": "auth.errors.emailExists",
  "Invalid token.": "auth.errors.sessionExpired",
  "Session expired.": "auth.errors.sessionExpired",
  "Not authenticated.": "auth.errors.notAuthenticated",
  "User not found.": "auth.errors.userNotFound",
  "Invalid or expired verification token.": "auth.errors.verifyTokenInvalid",
};

export function translateAuthError(message, t, fallbackKey = "auth.errors.generic") {
  if (!message) return t(fallbackKey);
  const key = AUTH_ERROR_KEY_BY_MESSAGE[message];
  return key ? t(key) : message;
}

export function extractAuthApiMessage(data, fallback) {
  const detail = data?.detail;
  if (typeof detail === "string") return detail;
  if (detail?.message && typeof detail.message === "string") return detail.message;
  return fallback;
}
