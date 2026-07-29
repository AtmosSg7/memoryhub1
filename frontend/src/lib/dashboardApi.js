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

export async function getDashboardStats() {
  const { res, data } = await apiFetch("/api/dashboard/stats");
  return handleResponse(res, data, "Failed to load dashboard stats.");
}
