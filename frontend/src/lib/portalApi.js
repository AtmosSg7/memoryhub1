import { API_BASE } from "@/lib/api";
import { reportApiFailure } from "@/lib/sentry";

function parseError(data, fallback) {
  const detail = data?.detail;
  if (typeof detail === "string") return { message: detail, code: undefined };
  if (detail?.message) return { message: detail.message, code: detail.code };
  return { message: fallback, code: undefined };
}

class PortalApiError extends Error {
  constructor(message, code) {
    super(message);
    this.name = "PortalApiError";
    this.code = code;
  }
}

async function portalFetch(path, options = {}) {
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      headers: { "Content-Type": "application/json", ...(options.headers || {}) },
      ...options,
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      if (res.status >= 500) {
        reportApiFailure(path, res.status, data);
      }
      const { message, code } = parseError(data, "Portal unavailable.");
      throw new PortalApiError(message, code);
    }
    return data;
  } catch (error) {
    if (!(error instanceof Error) || error.name === "TypeError") {
      reportApiFailure(path, 0, null, error);
    }
    throw error;
  }
}

export async function fetchPortalOverview(token) {
  return portalFetch(`/api/portal/${encodeURIComponent(token)}`);
}

export async function acceptPortalQuote(token, quoteId, body) {
  return portalFetch(
    `/api/portal/${encodeURIComponent(token)}/quotes/${encodeURIComponent(quoteId)}/accept`,
    { method: "POST", body: JSON.stringify(body) }
  );
}

export async function rejectPortalQuote(token, quoteId, body) {
  return portalFetch(
    `/api/portal/${encodeURIComponent(token)}/quotes/${encodeURIComponent(quoteId)}/reject`,
    { method: "POST", body: JSON.stringify(body) }
  );
}

export async function enableClientPortal(clientId) {
  const res = await fetch(`${API_BASE}/api/clients/${encodeURIComponent(clientId)}/portal`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(parseError(data, "Failed to enable portal.").message);
  }
  return data;
}

export async function getClientPortal(clientId) {
  const res = await fetch(`${API_BASE}/api/clients/${encodeURIComponent(clientId)}/portal`, {
    credentials: "include",
  });
  if (res.status === 404) return null;
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(parseError(data, "Failed to load portal.").message);
  }
  return data;
}

export async function shareClientPortalEmail(clientId, { recipientEmail, lang = "fr", idempotencyKey } = {}) {
  const body = { lang };
  if (recipientEmail) body.recipientEmail = recipientEmail;
  if (idempotencyKey) body.idempotencyKey = idempotencyKey;
  const res = await fetch(
    `${API_BASE}/api/clients/${encodeURIComponent(clientId)}/portal/share-email`,
    {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }
  );
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(parseError(data, "Failed to send portal email.").message);
  }
  return data;
}

export async function disableClientPortal(clientId) {
  const res = await fetch(`${API_BASE}/api/clients/${encodeURIComponent(clientId)}/portal`, {
    method: "DELETE",
    credentials: "include",
  });
  if (!res.ok && res.status !== 404) {
    const data = await res.json().catch(() => null);
    throw new Error(parseError(data, "Failed to disable portal.").message);
  }
}

export function resolvePortalUrl(portalUrl) {
  if (!portalUrl) return "";
  if (portalUrl.startsWith("http")) return portalUrl;
  if (typeof window === "undefined") return portalUrl;
  return `${window.location.origin}${portalUrl.startsWith("/") ? "" : "/"}${portalUrl}`;
}
