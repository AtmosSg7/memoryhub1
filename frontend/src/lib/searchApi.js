import { apiFetch } from "@/lib/api";

function parseError(data, fallback) {
  const detail = data?.detail;
  if (typeof detail === "string") return detail;
  if (detail?.message) return detail.message;
  return fallback;
}

export async function searchGlobal(query, signal, options = {}) {
  const params = new URLSearchParams({ q: query.trim() });
  if (options.types) params.set("types", options.types);
  if (options.limit != null) params.set("limit", String(options.limit));
  if (options.offset != null) params.set("offset", String(options.offset));
  const { res, data } = await apiFetch(`/api/search?${params}`, { signal });
  if (!res.ok) {
    throw new Error(parseError(data, "Search failed."));
  }
  return data;
}
