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
 * @typedef {object} Action
 * @property {string} id
 * @property {string} userId
 * @property {string|null} [clientId]
 * @property {string|null} [communicationId]
 * @property {string|null} [eventId]
 * @property {string} type
 * @property {'low'|'normal'|'high'|'urgent'} priority
 * @property {'pending'|'completed'|'dismissed'|'expired'} status
 * @property {string} source
 * @property {string} createdAt
 * @property {string|null} [dueAt]
 * @property {string|null} [completedAt]
 * @property {string|null} [snoozedUntil]
 * @property {string|null} [snoozedAt]
 * @property {string|null} [snoozedBy]
 * @property {string|null} [previousDueAt]
 * @property {string} title
 * @property {string|null} [description]
 * @property {Record<string, unknown>} [metadata]
 * @property {string} idempotencyKey
 */

/**
 * @param {{
 *   status?: string,
 *   type?: string,
 *   clientId?: string,
 *   limit?: number,
 *   offset?: number,
 *   includeSnoozed?: boolean,
 *   snoozedOnly?: boolean,
 * }} [opts]
 */
export async function listActions({
  status = "pending",
  type,
  clientId,
  limit = 50,
  offset = 0,
  includeSnoozed = false,
  snoozedOnly = false,
} = {}) {
  const params = new URLSearchParams();
  if (status) params.set("status", status);
  if (type) params.set("type", type);
  if (clientId) params.set("clientId", clientId);
  params.set("limit", String(limit));
  params.set("offset", String(offset));
  if (includeSnoozed) params.set("includeSnoozed", "true");
  if (snoozedOnly) params.set("snoozedOnly", "true");
  const { res, data } = await apiFetch(`/api/actions?${params}`);
  return handleResponse(res, data, "Failed to load actions.");
}

/** @param {{ status?: string, includeSnoozed?: boolean, snoozedOnly?: boolean }} [opts] */
export async function getActionsCount({
  status = "pending",
  includeSnoozed = false,
  snoozedOnly = false,
} = {}) {
  const params = new URLSearchParams();
  if (status) params.set("status", status);
  if (includeSnoozed) params.set("includeSnoozed", "true");
  if (snoozedOnly) params.set("snoozedOnly", "true");
  const { res, data } = await apiFetch(`/api/actions/count?${params}`);
  return handleResponse(res, data, "Failed to load actions count.");
}

/** @param {string} actionId */
export async function getAction(actionId) {
  const { res, data } = await apiFetch(`/api/actions/${encodeURIComponent(actionId)}`);
  return handleResponse(res, data, "Failed to load action.");
}

/** @param {string} actionId */
export async function completeAction(actionId) {
  const { res, data } = await apiFetch(
    `/api/actions/${encodeURIComponent(actionId)}/complete`,
    { method: "POST" }
  );
  return handleResponse(res, data, "Failed to complete action.");
}

/** @param {string} actionId */
export async function dismissAction(actionId) {
  const { res, data } = await apiFetch(
    `/api/actions/${encodeURIComponent(actionId)}/dismiss`,
    { method: "POST" }
  );
  return handleResponse(res, data, "Failed to dismiss action.");
}

/**
 * Postpone a pending action until ``until`` (ISO-8601).
 * @param {string} actionId
 * @param {string} until
 */
export async function snoozeAction(actionId, until) {
  const { res, data } = await apiFetch(
    `/api/actions/${encodeURIComponent(actionId)}/snooze`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ until }),
    }
  );
  return handleResponse(res, data, "Failed to postpone action.");
}
