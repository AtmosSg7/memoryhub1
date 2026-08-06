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

/** @param {string} communicationId */
export async function getCommunicationIntelligence(communicationId) {
  const { res, data } = await apiFetch(
    `/api/communication-intelligence/${encodeURIComponent(communicationId)}`
  );
  if (res.status === 404) return null;
  return handleResponse(res, data, "Failed to load analysis.");
}

/**
 * @param {string} communicationId
 * @param {{ force?: boolean }} [opts]
 */
export async function analyzeCommunication(communicationId, { force = false } = {}) {
  const { res, data } = await apiFetch(
    `/api/communication-intelligence/${encodeURIComponent(communicationId)}/analyze`,
    {
      method: "POST",
      body: JSON.stringify({ force }),
    }
  );
  return handleResponse(res, data, "Failed to analyze communication.");
}

/** @param {string} communicationId */
export async function acceptIntelligenceSuggestion(communicationId) {
  const { res, data } = await apiFetch(
    `/api/communication-intelligence/${encodeURIComponent(communicationId)}/accept`,
    { method: "POST" }
  );
  return handleResponse(res, data, "Failed to accept suggestion.");
}

/** @param {string} communicationId */
export async function rejectIntelligenceSuggestion(communicationId) {
  const { res, data } = await apiFetch(
    `/api/communication-intelligence/${encodeURIComponent(communicationId)}/reject`,
    { method: "POST" }
  );
  return handleResponse(res, data, "Failed to reject suggestion.");
}
