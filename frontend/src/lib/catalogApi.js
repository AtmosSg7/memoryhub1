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

export async function listCatalogItems({ limit = 100 } = {}) {
  const params = new URLSearchParams();
  if (limit) params.set("limit", String(limit));
  const query = params.toString() ? `?${params.toString()}` : "";
  const { res, data } = await apiFetch(`/api/catalog${query}`);
  return handleResponse(res, data, "Failed to load catalog.");
}

export async function suggestCatalogItems(query, { limit = 100 } = {}) {
  const params = new URLSearchParams({ q: query });
  if (limit) params.set("limit", String(limit));
  const { res, data } = await apiFetch(`/api/catalog/suggest?${params.toString()}`);
  return handleResponse(res, data, "Failed to search catalog.");
}

export async function getCatalogStats() {
  const { res, data } = await apiFetch("/api/catalog/stats");
  return handleResponse(res, data, "Failed to load catalog stats.");
}
