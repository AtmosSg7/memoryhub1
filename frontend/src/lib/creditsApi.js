import { apiFetch } from "@/lib/api";

export class AnalysesApiError extends Error {
  constructor(message, { status, code, analysesRequired, analysesAvailable, tierKey } = {}) {
    super(message);
    this.name = "AnalysesApiError";
    this.status = status;
    this.code = code;
    this.analysesRequired = analysesRequired;
    this.analysesAvailable = analysesAvailable;
    this.tierKey = tierKey;
  }
}

function parseDetail(data, fallback) {
  const detail = data?.detail;
  if (typeof detail === "string") return detail;
  if (detail?.message) return detail.message;
  return fallback;
}

async function handleResponse(res, data, fallback) {
  if (!res.ok) {
    const detail = data?.detail || {};
    throw new AnalysesApiError(parseDetail(data, fallback), {
      status: res.status,
      code: detail.code,
      analysesRequired: detail.analysesRequired,
      analysesAvailable: detail.analysesAvailable,
      tierKey: detail.tierKey,
    });
  }
  return data;
}

export async function fetchCreditBalance() {
  const { res, data } = await apiFetch("/api/credits/balance");
  return handleResponse(res, data, "Failed to load import balance.");
}

export async function fetchImportEstimate({ extension, sizeBytes, mimeType, files }) {
  const { res, data } = await apiFetch("/api/imports/estimate", {
    method: "POST",
    body: JSON.stringify({
      extension,
      sizeBytes,
      mimeType: mimeType || undefined,
      files: files || undefined,
    }),
  });
  return handleResponse(res, data, "Failed to estimate import.");
}

export async function fetchAiUsageHistory({ limit = 50, offset = 0, actionKey } = {}) {
  const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
  if (actionKey) params.set("actionKey", actionKey);
  const { res, data } = await apiFetch(`/api/credits/ai-history?${params}`);
  return handleResponse(res, data, "Failed to load AI usage history.");
}
