import { apiFetch } from "@/lib/api";
import { apiUpload } from "@/lib/apiUpload";

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

export async function analyzeImport(file) {
  const formData = new FormData();
  formData.append("file", file);
  const { res, data } = await apiUpload("/api/imports/analyze", formData);
  return handleResponse(res, data, "Failed to analyze document.");
}

export async function getImportSession(sessionId) {
  const { res, data } = await apiFetch(`/api/imports/${sessionId}`);
  return handleResponse(res, data, "Failed to load import session.");
}

export async function confirmImport(sessionId, payload) {
  const { res, data } = await apiFetch(`/api/imports/${sessionId}/confirm`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return handleResponse(res, data, "Failed to confirm import.");
}
