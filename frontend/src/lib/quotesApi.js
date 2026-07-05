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

export async function listQuotes({ clientId, status } = {}) {
  const params = new URLSearchParams();
  if (clientId) params.set("clientId", clientId);
  if (status) params.set("status", status);
  const query = params.toString() ? `?${params.toString()}` : "";
  const { res, data } = await apiFetch(`/api/quotes${query}`);
  return handleResponse(res, data, "Failed to load quotes.");
}

export async function createQuote(payload) {
  const { res, data } = await apiFetch("/api/quotes", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return handleResponse(res, data, "Failed to create quote.");
}

export async function updateQuote(quoteId, payload) {
  const { res, data } = await apiFetch(`/api/quotes/${quoteId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
  return handleResponse(res, data, "Failed to update quote.");
}

export async function deleteQuote(quoteId) {
  const { res, data } = await apiFetch(`/api/quotes/${quoteId}`, { method: "DELETE" });
  if (!res.ok) throw new Error(parseError(data, "Failed to delete quote."));
}

export async function convertQuoteToInvoice(quoteId) {
  const { res, data } = await apiFetch(`/api/quotes/${quoteId}/convert-to-invoice`, {
    method: "POST",
  });
  return handleResponse(res, data, "Failed to convert quote to invoice.");
}
