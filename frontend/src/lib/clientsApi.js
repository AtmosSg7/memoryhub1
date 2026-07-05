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

export async function listClients() {
  const { res, data } = await apiFetch("/api/clients");
  return handleResponse(res, data, "Failed to load clients.");
}

export async function getRecentClients() {
  const { res, data } = await apiFetch("/api/clients/recent");
  return handleResponse(res, data, "Failed to load recent clients.");
}

export async function getClient(clientId) {
  const { res, data } = await apiFetch(`/api/clients/${clientId}`);
  return handleResponse(res, data, "Failed to load client.");
}

export async function createClient(payload) {
  const { res, data } = await apiFetch("/api/clients", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return handleResponse(res, data, "Failed to create client.");
}

export async function updateClient(clientId, payload) {
  const { res, data } = await apiFetch(`/api/clients/${clientId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
  return handleResponse(res, data, "Failed to update client.");
}

export async function deleteClient(clientId) {
  const { res, data } = await apiFetch(`/api/clients/${clientId}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    throw new Error(parseError(data, "Failed to delete client."));
  }
}
