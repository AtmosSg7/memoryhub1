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

/**
 * GET /api/analytics/overview
 * @param {{ period?: string, from?: string, to?: string, timezone?: string, sort?: string }} params
 */
export async function getAnalyticsOverview(params = {}) {
  const search = new URLSearchParams();
  if (params.period) search.set("period", params.period);
  if (params.from) search.set("from", params.from);
  if (params.to) search.set("to", params.to);
  if (params.timezone) search.set("timezone", params.timezone);
  if (params.sort) search.set("sort", params.sort);
  const qs = search.toString();
  const { res, data } = await apiFetch(`/api/analytics/overview${qs ? `?${qs}` : ""}`);
  return handleResponse(res, data, "Failed to load analytics overview.");
}
