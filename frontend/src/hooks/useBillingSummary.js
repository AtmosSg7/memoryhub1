import { useCallback, useEffect, useState } from "react";
import { fetchBillingMe } from "@/lib/billingApi";

let sharedBilling = null;
let sharedListeners = new Set();
let inflight = null;

function notifyListeners() {
  sharedListeners.forEach((listener) => listener(sharedBilling));
}

async function loadSharedBilling() {
  if (inflight) return inflight;
  inflight = fetchBillingMe()
    .then((data) => {
      sharedBilling = data;
      notifyListeners();
      return data;
    })
    .catch(() => {
      sharedBilling = null;
      notifyListeners();
      return null;
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

/** Publish billing data as the shared source of truth for all dashboard consumers. */
export function setBillingCache(data) {
  sharedBilling = data ?? null;
  notifyListeners();
}

/** Clear cache and reload if any consumer is still mounted. */
export function invalidateBillingCache() {
  sharedBilling = null;
  inflight = null;
  notifyListeners();
  if (sharedListeners.size > 0) {
    void loadSharedBilling();
  }
}

/**
 * Plan label for UI widgets — always prefer the real plan name from /billing/me.
 * Never map "no shared cache / no subscription" to "Essai gratuit".
 */
export function resolveSubscriptionPlanLabel(billing, t) {
  const planId = billing?.planId;
  if (planId) return t(`billingPage.plans.${planId}`);
  if (billing?.subscriptionStatus === "trial") return t("sidebar.subscription.trial");
  return t("sidebar.subscription.none");
}

export function useBillingSummary({ enabled = true } = {}) {
  const [billing, setBilling] = useState(sharedBilling);
  const [loading, setLoading] = useState(enabled && !sharedBilling);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await loadSharedBilling();
      setBilling(data);
      return data;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!enabled) return undefined;

    const listener = (next) => {
      setBilling(next);
      if (next) setLoading(false);
    };
    sharedListeners.add(listener);
    if (sharedBilling) {
      setBilling(sharedBilling);
      setLoading(false);
    } else {
      refresh();
    }

    return () => {
      sharedListeners.delete(listener);
    };
  }, [enabled, refresh]);

  return {
    billing,
    planId: billing?.planId || null,
    hasSubscription: Boolean(billing?.hasSubscription),
    subscriptionStatus: billing?.subscriptionStatus || null,
    monthlyRemaining: billing?.monthlyAnalysesRemaining ?? null,
    monthlyAllocated: billing?.monthlyAnalysesAllocated ?? null,
    loading,
    refresh,
  };
}
