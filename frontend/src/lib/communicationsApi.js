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

export async function listCommunications({ clientId, category, limit = 50 } = {}) {
  const params = new URLSearchParams();
  if (clientId) params.set("clientId", clientId);
  if (category) params.set("category", category);
  params.set("limit", String(limit));
  const query = params.toString() ? `?${params.toString()}` : "";
  const { res, data } = await apiFetch(`/api/communications${query}`);
  return handleResponse(res, data, "Failed to load communications.");
}

export async function listUnlinkedEmails({
  limit = 20,
  offset = 0,
  linkStatus = "unlinked",
  includeIgnored = false,
} = {}) {
  const params = new URLSearchParams();
  params.set("limit", String(limit));
  params.set("offset", String(offset));
  if (linkStatus) params.set("linkStatus", linkStatus);
  if (includeIgnored) params.set("includeIgnored", "true");
  const { res, data } = await apiFetch(`/api/communications/unlinked?${params}`);
  return handleResponse(res, data, "Failed to load unlinked emails.");
}

export async function getUnlinkedEmailCount() {
  const { res, data } = await apiFetch("/api/communications/unlinked/count");
  return handleResponse(res, data, "Failed to load unlinked count.");
}

export async function associateCommunication(communicationId, clientId) {
  const { res, data } = await apiFetch(`/api/communications/${communicationId}/associate`, {
    method: "POST",
    body: JSON.stringify({ clientId }),
  });
  return handleResponse(res, data, "Failed to associate email.");
}

export async function ignoreCommunication(communicationId) {
  const { res, data } = await apiFetch(`/api/communications/${communicationId}/ignore`, {
    method: "POST",
  });
  return handleResponse(res, data, "Failed to ignore email.");
}

export async function restoreCommunication(communicationId) {
  const { res, data } = await apiFetch(`/api/communications/${communicationId}/restore`, {
    method: "POST",
  });
  return handleResponse(res, data, "Failed to restore email.");
}

export async function dismissEmailSuggestion(communicationId) {
  const { res, data } = await apiFetch(
    `/api/communications/${communicationId}/dismiss-suggestion`,
    { method: "POST" }
  );
  return handleResponse(res, data, "Failed to dismiss suggestion.");
}

export async function getEmailClientPrefill(communicationId) {
  const { res, data } = await apiFetch(`/api/communications/${communicationId}/prefill-client`);
  return handleResponse(res, data, "Failed to load client prefill.");
}

export async function createClientFromEmail(communicationId, payload = {}) {
  const { res, data } = await apiFetch(`/api/communications/${communicationId}/create-client`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return handleResponse(res, data, "Failed to create client from email.");
}
