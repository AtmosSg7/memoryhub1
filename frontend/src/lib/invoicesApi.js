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



export async function listInvoices({ clientId, status } = {}) {

  const params = new URLSearchParams();

  if (clientId) params.set("clientId", clientId);

  if (status) params.set("status", status);

  const query = params.toString() ? `?${params.toString()}` : "";

  const { res, data } = await apiFetch(`/api/invoices${query}`);

  return handleResponse(res, data, "Failed to load invoices.");

}

export async function getInvoice(invoiceId) {
  const { res, data } = await apiFetch(`/api/invoices/${invoiceId}`);
  return handleResponse(res, data, "Failed to load invoice.");
}



export async function createInvoice(payload) {

  const { res, data } = await apiFetch("/api/invoices", {

    method: "POST",

    body: JSON.stringify(payload),

  });

  return handleResponse(res, data, "Failed to create invoice.");

}



export async function updateInvoice(invoiceId, payload) {

  const { res, data } = await apiFetch(`/api/invoices/${invoiceId}`, {

    method: "PUT",

    body: JSON.stringify(payload),

  });

  return handleResponse(res, data, "Failed to update invoice.");

}



export async function deleteInvoice(invoiceId) {

  const { res, data } = await apiFetch(`/api/invoices/${invoiceId}`, { method: "DELETE" });

  if (!res.ok) throw new Error(parseError(data, "Failed to delete invoice."));

}

export async function markInvoicePaid(invoiceId) {
  const { res, data } = await apiFetch(`/api/invoices/${invoiceId}/mark-paid`, { method: "POST" });
  return handleResponse(res, data, "Failed to mark invoice as paid.");
}

export async function markInvoiceInProgress(invoiceId) {
  const { res, data } = await apiFetch(`/api/invoices/${invoiceId}/mark-in-progress`, { method: "POST" });
  return handleResponse(res, data, "Failed to reopen invoice.");
}


