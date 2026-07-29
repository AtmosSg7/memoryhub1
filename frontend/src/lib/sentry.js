import * as Sentry from "@sentry/react";

const SENSITIVE_KEY = /password|token|secret|authorization|cookie|api[_-]?key|jwt|bearer|access_token/i;
const BEARER_PATTERN = /Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi;
const JWT_PATTERN = /eyJ[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+/g;

const USER_SALT = process.env.REACT_APP_SENTRY_USER_SALT || "memoryhub-dev-sentry-salt";

let sentryEnabled = false;

function scrubValue(key, value) {
  if (typeof key === "string" && SENSITIVE_KEY.test(key)) {
    return "[Filtered]";
  }
  if (typeof value === "string") {
    if (BEARER_PATTERN.test(value) || JWT_PATTERN.test(value)) {
      return "[Filtered]";
    }
    return value.replace(BEARER_PATTERN, "[Filtered]").replace(JWT_PATTERN, "[Filtered]");
  }
  if (Array.isArray(value)) {
    return value.map((item, index) => scrubValue(String(index), item));
  }
  if (value && typeof value === "object") {
    return scrubObject(value);
  }
  return value;
}

function scrubObject(data) {
  if (!data || typeof data !== "object") {
    return data;
  }
  return Object.fromEntries(
    Object.entries(data).map(([key, value]) => [key, scrubValue(key, value)]),
  );
}

export function anonymizeUserId(userId) {
  if (!userId) return undefined;
  let hash = 5381;
  const input = `${USER_SALT}:${userId}`;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 33) ^ input.charCodeAt(i);
  }
  return `u_${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

function scrubEvent(event) {
  if (event.request?.headers) {
    event.request.headers = scrubObject(event.request.headers);
  }
  if (event.request?.cookies) {
    event.request.cookies = scrubObject(event.request.cookies);
  }
  if (event.request?.data) {
    event.request.data = scrubObject(event.request.data);
  }
  if (event.extra) {
    event.extra = scrubObject(event.extra);
  }
  if (event.user) {
    event.user = event.user.id ? { id: event.user.id } : {};
  }
  return event;
}

export function initSentry() {
  const dsn = process.env.REACT_APP_SENTRY_DSN?.trim();
  if (!dsn) {
    return false;
  }

  const environment =
    process.env.REACT_APP_ENV || process.env.NODE_ENV || "development";
  const tracesSampleRate = Number(process.env.REACT_APP_SENTRY_TRACES_SAMPLE_RATE || "0.1");

  Sentry.init({
    dsn,
    environment,
    enabled: true,
    sendDefaultPii: false,
    tracesSampleRate: Number.isFinite(tracesSampleRate) ? tracesSampleRate : 0.1,
    beforeSend: scrubEvent,
    integrations: [Sentry.browserTracingIntegration()],
  });

  sentryEnabled = true;
  return true;
}

export function isSentryEnabled() {
  return sentryEnabled;
}

export function setSentryUser(user) {
  if (!sentryEnabled) return;
  if (!user?.id) {
    Sentry.setUser(null);
    return;
  }
  Sentry.setUser({ id: anonymizeUserId(user.id) });
}

export function reportApiFailure(path, status, data, error) {
  if (!sentryEnabled) return;
  if (status !== 0 && status < 500) return;

  Sentry.withScope((scope) => {
    scope.setTag("api.path", path);
    scope.setTag("api.status", String(status || "network"));
    scope.setExtra("response", scrubObject(data));
    if (error instanceof Error) {
      Sentry.captureException(error);
      return;
    }
    Sentry.captureMessage(`API ${path} failed with status ${status || "network"}`, "error");
  });
}

export function captureException(error) {
  if (!sentryEnabled) return;
  Sentry.captureException(error);
}

export { Sentry };
