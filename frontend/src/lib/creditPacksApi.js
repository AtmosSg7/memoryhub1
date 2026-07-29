import { apiFetch } from "@/lib/api";
import { invalidateCreditsCache } from "@/hooks/useCredits";

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

export async function fetchCreditPacks() {
  const { res, data } = await apiFetch("/api/billing/credit-packs");
  return handleResponse(res, data, "Failed to load credit packs.");
}

export async function fetchCreditPurchases({ limit = 50 } = {}) {
  const params = new URLSearchParams({ limit: String(limit) });
  const { res, data } = await apiFetch(`/api/billing/credit-purchases?${params}`);
  return handleResponse(res, data, "Failed to load credit purchases.");
}

export async function devPurchaseCreditPack(packKey, { idempotencyKey } = {}) {
  const headers = {};
  if (idempotencyKey) headers["Idempotency-Key"] = idempotencyKey;
  const { res, data } = await apiFetch("/api/billing/credit-packs/dev-purchase", {
    method: "POST",
    body: JSON.stringify({ packKey }),
    headers,
  });
  const result = await handleResponse(res, data, "Failed to simulate credit purchase.");
  invalidateCreditsCache();
  return result;
}

export async function checkoutCreditPack(packKey) {
  const { res, data } = await apiFetch("/api/billing/credit-packs/checkout", {
    method: "POST",
    body: JSON.stringify({ packKey }),
  });
  return handleResponse(res, data, "Failed to start credit checkout.");
}
