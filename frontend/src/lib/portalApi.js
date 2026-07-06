import { API_BASE } from "@/lib/api";

function parseError(data, fallback) {
  const detail = data?.detail;
  if (typeof detail === "string") return detail;
  if (detail?.message) return detail.message;
  return fallback;
}

async function portalFetch(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(parseError(data, "Portal unavailable."));
  }
  return data;
}

export async function fetchPortalOverview(token) {
  return portalFetch(`/api/portal/${encodeURIComponent(token)}`);
}

export async function acceptPortalQuote(token, quoteId) {
  return portalFetch(
    `/api/portal/${encodeURIComponent(token)}/quotes/${encodeURIComponent(quoteId)}/accept`,
    { method: "POST" }
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
    throw new Error(parseError(data, "Failed to enable portal."));
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
    throw new Error(parseError(data, "Failed to load portal."));
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
    throw new Error(parseError(data, "Failed to disable portal."));
  }
}

export function resolvePortalUrl(portalUrl) {
  if (!portalUrl) return "";
  if (portalUrl.startsWith("http")) return portalUrl;
  if (typeof window === "undefined") return portalUrl;
  return `${window.location.origin}${portalUrl.startsWith("/") ? "" : "/"}${portalUrl}`;
}
