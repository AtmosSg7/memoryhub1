import { API_BASE, apiFetch } from "@/lib/api";

function parseError(data, fallback) {
  const detail = data?.detail;
  if (typeof detail === "string") return detail;
  if (detail?.message) return detail.message;
  return fallback;
}

async function handleResponse(res, data, fallback) {
  if (!res.ok) throw new Error(parseError(data, fallback));
  return data;
}

export async function previewFollowUp({ entityType, entityId, lang = "fr" }) {
  const params = new URLSearchParams({ entityType, entityId, lang });
  const { res, data } = await apiFetch(`/api/follow-ups/preview?${params.toString()}`);
  return handleResponse(res, data, "Failed to load follow-up message.");
}

export async function recordFollowUp({ entityType, entityId, message, subject, lang = "fr" }) {
  const params = new URLSearchParams({ lang });
  const { res, data } = await apiFetch(`/api/follow-ups?${params.toString()}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ entityType, entityId, message, subject }),
  });
  return handleResponse(res, data, "Failed to record follow-up.");
}

export async function listFollowUps({ clientId, limit = 50 } = {}) {
  const params = new URLSearchParams();
  if (clientId) params.set("clientId", clientId);
  params.set("limit", String(limit));
  const { res, data } = await apiFetch(`/api/follow-ups?${params.toString()}`);
  return handleResponse(res, data, "Failed to load follow-ups.");
}

export async function getLastFollowUps({ entityType, entityIds }) {
  if (!entityIds?.length) return { items: {} };
  const params = new URLSearchParams({
    entityType,
    entityIds: entityIds.join(","),
  });
  const { res, data } = await apiFetch(`/api/follow-ups/last?${params.toString()}`);
  return handleResponse(res, data, "Failed to load follow-up history.");
}
