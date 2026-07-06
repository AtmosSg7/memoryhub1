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

export async function listReminders({ limit = 50 } = {}) {
  const params = new URLSearchParams();
  if (limit) params.set("limit", String(limit));
  const query = params.toString() ? `?${params.toString()}` : "";
  const { res, data } = await apiFetch(`/api/reminders${query}`);
  return handleResponse(res, data, "Failed to load reminders.");
}
