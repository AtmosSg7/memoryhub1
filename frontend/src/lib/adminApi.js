import { apiFetch } from "@/lib/api";

export async function fetchAdminOverview(period = "30d") {
  return apiFetch(`/api/admin/overview?period=${encodeURIComponent(period)}`);
}

export async function fetchAdminUsers({ q, page = 1, pageSize = 25 } = {}) {
  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  if (q) params.set("q", q);
  return apiFetch(`/api/admin/users?${params}`);
}

export async function fetchAdminUserDetail(userId) {
  return apiFetch(`/api/admin/users/${encodeURIComponent(userId)}`);
}

export async function fetchAdminSubscriptions({ status, page = 1, pageSize = 25 } = {}) {
  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  if (status) params.set("status", status);
  return apiFetch(`/api/admin/subscriptions?${params}`);
}

export async function fetchAdminAiUsage({ period = "30d", page = 1, pageSize = 25 } = {}) {
  const params = new URLSearchParams({ period, page: String(page), pageSize: String(pageSize) });
  return apiFetch(`/api/admin/ai-usage?${params}`);
}

export async function fetchAdminImports({ period = "30d", status, page = 1, pageSize = 25 } = {}) {
  const params = new URLSearchParams({ period, page: String(page), pageSize: String(pageSize) });
  if (status) params.set("status", status);
  return apiFetch(`/api/admin/imports?${params}`);
}

export async function fetchAdminEmails({ period = "30d", status, page = 1, pageSize = 25 } = {}) {
  const params = new URLSearchParams({ period, page: String(page), pageSize: String(pageSize) });
  if (status) params.set("status", status);
  return apiFetch(`/api/admin/emails?${params}`);
}

export async function fetchAdminCredits({ period = "30d", page = 1, pageSize = 25 } = {}) {
  const params = new URLSearchParams({ period, page: String(page), pageSize: String(pageSize) });
  return apiFetch(`/api/admin/credits?${params}`);
}

export async function fetchAdminErrors(period = "30d") {
  return apiFetch(`/api/admin/errors?period=${encodeURIComponent(period)}`);
}

export async function fetchAdminSystemHealth() {
  return apiFetch("/api/admin/system-health");
}

export async function adminGrantCredits(userId, payload) {
  return apiFetch(`/api/admin/users/${encodeURIComponent(userId)}/grant-credits`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function adminSuspendUser(userId, reason) {
  return apiFetch(`/api/admin/users/${encodeURIComponent(userId)}/suspend`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
}

export async function adminResumeUser(userId) {
  return apiFetch(`/api/admin/users/${encodeURIComponent(userId)}/resume`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export async function adminResendVerification(userId) {
  return apiFetch(`/api/admin/users/${encodeURIComponent(userId)}/resend-verification`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export async function adminSimulateCredits(payload) {
  return apiFetch("/api/admin/credits/simulate", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function adminExportUrl(resource, period = "30d") {
  const base = process.env.REACT_APP_API_URL || "";
  return `${base}/api/admin/export/${resource}?period=${encodeURIComponent(period)}`;
}
