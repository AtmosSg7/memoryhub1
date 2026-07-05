import { apiFetch } from "@/lib/api";

function parseError(data, fallback) {
  const detail = data?.detail;
  if (typeof detail === "string") return detail;
  if (detail?.message) return detail.message;
  return fallback;
}

async function handleResponse(res, data, fallback) {
  if (!res.ok) {
    throw new Error(parseError(data, fallback));
  }
  return data;
}

export async function listRecentEvents(limit = 10) {
  const { res, data } = await apiFetch(
    `/api/events/recent?limit=${encodeURIComponent(limit)}`
  );
  return handleResponse(res, data, "Failed to load recent activity.");
}

export async function listClientEvents(clientId, limit = 50) {
  const params = new URLSearchParams({
    clientId,
    limit: String(limit),
  });
  const { res, data } = await apiFetch(`/api/events?${params.toString()}`);
  return handleResponse(res, data, "Failed to load client timeline.");
}
