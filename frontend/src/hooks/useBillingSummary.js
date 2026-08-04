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

    const listener = (next) => setBilling(next);
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
    monthlyRemaining: billing?.monthlyAnalysesRemaining ?? null,
    monthlyAllocated: billing?.monthlyAnalysesAllocated ?? null,
    loading,
    refresh,
  };
}

export function invalidateBillingCache() {
  sharedBilling = null;
  notifyListeners();
}
