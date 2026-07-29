import { apiFetch } from "@/lib/api";

export async function fetchBillingMe() {
  const { res, data } = await apiFetch("/api/billing/me");
  if (!res.ok) {
    throw new Error(data?.detail?.message || data?.message || "Failed to load billing");
  }
  return data;
}

export async function startCheckout(planId) {
  const { res, data } = await apiFetch("/api/billing/checkout", {
    method: "POST",
    body: JSON.stringify({ planId }),
  });
  if (!res.ok) {
    const err = new Error(data?.detail?.message || data?.message || "Checkout failed");
    err.code = data?.detail?.code || data?.code;
    throw err;
  }
  return data;
}

export async function openBillingPortal() {
  const { res, data } = await apiFetch("/api/billing/portal", { method: "POST" });
  if (!res.ok) {
    throw new Error(data?.detail?.message || data?.message || "Portal failed");
  }
  return data;
}

export async function changeBillingPlan(planId) {
  const { res, data } = await apiFetch("/api/billing/change-plan", {
    method: "POST",
    body: JSON.stringify({ planId }),
  });
  if (!res.ok) {
    throw new Error(data?.detail?.message || data?.message || "Plan change failed");
  }
  return data;
}
