import { apiFetch } from "@/lib/api";

function parseError(data, fallback) {
  const detail = data?.detail;
  if (typeof detail === "string") return detail;
  if (detail?.message) return detail.message;
  return fallback;
}

export async function searchGlobal(query, signal) {
  const params = new URLSearchParams({ q: query.trim() });
  const { res, data } = await apiFetch(`/api/search?${params}`, { signal });
  if (!res.ok) {
    throw new Error(parseError(data, "Search failed."));
  }
  return data;
}
