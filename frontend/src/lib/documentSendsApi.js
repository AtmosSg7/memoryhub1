import { API_BASE, apiFetch } from "@/lib/api";

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

export async function previewDocumentSend({ entityType, entityId, lang = "fr" }) {
  const params = new URLSearchParams({ entityType, entityId, lang });
  const { res, data } = await apiFetch(`/api/document-sends/preview?${params.toString()}`);
  return handleResponse(res, data, "Failed to load send message.");
}

export async function recordDocumentSend({ entityType, entityId, message, subject, lang = "fr" }) {
  const params = new URLSearchParams({ lang });
  const { res, data } = await apiFetch(`/api/document-sends?${params.toString()}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ entityType, entityId, message, subject }),
  });
  return handleResponse(res, data, "Failed to record send.");
}

export { resolvePortalUrl } from "@/lib/portalApi";
