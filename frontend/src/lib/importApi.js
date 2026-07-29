import { apiFetch } from "@/lib/api";
import { apiUpload } from "@/lib/apiUpload";
import { AnalysesApiError } from "@/lib/creditsApi";

function parseError(data, fallback) {
  const detail = data?.detail;
  if (typeof detail === "string") return detail;
  if (detail?.message) return detail.message;
  return fallback;
}

async function handleResponse(res, data, fallback) {
  if (res.ok) return data;

  const detail = data?.detail || {};
  if (res.status === 402) {
    throw new AnalysesApiError(parseError(data, fallback), {
      status: 402,
      code: detail.code,
      analysesRequired: detail.analysesRequired,
      analysesAvailable: detail.analysesAvailable,
      tierKey: detail.tierKey,
    });
  }

  throw new Error(parseError(data, fallback));
}

export async function listImports({ limit = 20 } = {}) {
  const params = new URLSearchParams({ limit: String(limit) });
  const { res, data } = await apiFetch(`/api/imports?${params}`);
  return handleResponse(res, data, "Failed to load imports.");
}

export async function getImport(sessionId) {
  const { res, data } = await apiFetch(`/api/imports/${sessionId}`);
  return handleResponse(res, data, "Failed to load import session.");
}

export async function analyzeImport(files) {
  const uploads = Array.isArray(files) ? files : [files];
  const formData = new FormData();
  if (uploads.length === 1) {
    formData.append("file", uploads[0]);
  } else {
    uploads.forEach((file) => formData.append("files", file));
  }
  const { res, data } = await apiUpload("/api/imports/analyze", formData);
  return handleResponse(res, data, "Failed to analyze document.");
}

export async function confirmImport(sessionId, payload) {
  const { res, data } = await apiFetch(`/api/imports/${sessionId}/confirm`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return handleResponse(res, data, "Failed to confirm import.");
}

export { AnalysesApiError as CreditsApiError };
