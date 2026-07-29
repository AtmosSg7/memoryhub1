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

export async function listDuePersonalReminders({ limit = 20 } = {}) {
  const params = new URLSearchParams({ limit: String(limit) });
  const { res, data } = await apiFetch(`/api/personal-reminders/due?${params.toString()}`);
  return handleResponse(res, data, "Failed to load personal reminders.");
}

export async function completePersonalReminder(reminderId) {
  const { res, data } = await apiFetch(`/api/personal-reminders/${reminderId}/complete`, {
    method: "POST",
  });
  return handleResponse(res, data, "Failed to complete reminder.");
}

export async function snoozePersonalReminder(reminderId, remindAt) {
  const { res, data } = await apiFetch(`/api/personal-reminders/${reminderId}/snooze`, {
    method: "POST",
    body: JSON.stringify({ remindAt }),
  });
  return handleResponse(res, data, "Failed to snooze reminder.");
}
