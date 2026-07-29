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

export async function listRecentEvents(limit = 10, offset = 0) {
  const params = new URLSearchParams({
    limit: String(limit),
    offset: String(offset),
  });
  const { res, data } = await apiFetch(`/api/events/recent?${params.toString()}`);
  return handleResponse(res, data, "Failed to load recent activity.");
}

/**
 * @param {string} clientId
 * @param {number|{limit?: number, offset?: number}} limitOrOptions
 */
export async function listClientEvents(clientId, limitOrOptions = 50) {
  const options =
    typeof limitOrOptions === "object" && limitOrOptions !== null
      ? limitOrOptions
      : { limit: limitOrOptions, offset: 0 };
  const params = new URLSearchParams({
    clientId,
    limit: String(options.limit ?? 50),
    offset: String(options.offset ?? 0),
  });
  const { res, data } = await apiFetch(`/api/events?${params.toString()}`);
  return handleResponse(res, data, "Failed to load client timeline.");
}
