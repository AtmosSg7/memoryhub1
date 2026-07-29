import { apiFetch } from "@/lib/api";

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

export async function getIntelligenceOverview({ force = false } = {}) {
  const q = force ? "?force=true" : "";
  const { res, data } = await apiFetch(`/api/intelligence/overview${q}`);
  return handleResponse(res, data, "Failed to load memory intelligence.");
}

export async function getClientIntelligence(clientId, { force = false } = {}) {
  const q = force ? "?force=true" : "";
  const { res, data } = await apiFetch(`/api/intelligence/clients/${encodeURIComponent(clientId)}${q}`);
  return handleResponse(res, data, "Failed to load client insights.");
}
