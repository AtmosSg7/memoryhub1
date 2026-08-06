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

/** @typedef {'pending'|'ignored'|'associated'|'converted'|'automatic'|'all'} ProspectStatus */

/**
 * @param {{ limit?: number, offset?: number, status?: ProspectStatus, includeAutomatic?: boolean }} [opts]
 */
export async function listProspects({
  limit = 20,
  offset = 0,
  status = "pending",
  includeAutomatic = false,
} = {}) {
  const params = new URLSearchParams();
  params.set("limit", String(limit));
  params.set("offset", String(offset));
  if (status) params.set("status", status);
  if (includeAutomatic) params.set("includeAutomatic", "true");
  const { res, data } = await apiFetch(`/api/prospects?${params}`);
  return handleResponse(res, data, "Failed to load prospects.");
}

/**
 * @param {{ status?: ProspectStatus, includeAutomatic?: boolean }} [opts]
 */
export async function getProspectsCount({ status = "pending", includeAutomatic = false } = {}) {
  const params = new URLSearchParams();
  params.set("status", status);
  if (includeAutomatic) params.set("includeAutomatic", "true");
  const { res, data } = await apiFetch(`/api/prospects/count?${params}`);
  return handleResponse(res, data, "Failed to load prospects count.");
}

export async function getProspect(prospectId) {
  const { res, data } = await apiFetch(`/api/prospects/${prospectId}`);
  return handleResponse(res, data, "Failed to load prospect.");
}

export async function associateProspect(prospectId, clientId) {
  const { res, data } = await apiFetch(`/api/prospects/${prospectId}/associate`, {
    method: "POST",
    body: JSON.stringify({ clientId }),
  });
  return handleResponse(res, data, "Failed to associate prospect.");
}

export async function createClientFromProspect(prospectId, payload = {}) {
  const { res, data } = await apiFetch(`/api/prospects/${prospectId}/create-client`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return handleResponse(res, data, "Failed to create client from prospect.");
}

export async function ignoreProspect(prospectId) {
  const { res, data } = await apiFetch(`/api/prospects/${prospectId}/ignore`, {
    method: "POST",
  });
  return handleResponse(res, data, "Failed to ignore prospect.");
}

export async function restoreProspect(prospectId) {
  const { res, data } = await apiFetch(`/api/prospects/${prospectId}/restore`, {
    method: "POST",
  });
  return handleResponse(res, data, "Failed to restore prospect.");
}
