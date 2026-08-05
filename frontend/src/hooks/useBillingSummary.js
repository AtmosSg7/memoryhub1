import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchBillingMe } from "@/lib/billingApi";
import { buildBillingViewModel } from "@/lib/billingPresentation";
import { useDashboardLang } from "@/hooks/useDashboardLang";

let sharedBilling = null;
let sharedError = null;
let sharedListeners = new Set();
let inflight = null;

function notifyListeners() {
  sharedListeners.forEach((listener) => listener({ billing: sharedBilling, error: sharedError }));
}

async function loadSharedBilling() {
  if (inflight) return inflight;
  inflight = fetchBillingMe()
    .then((data) => {
      sharedBilling = data;
      sharedError = null;
      notifyListeners();
      return data;
    })
    .catch((err) => {
      sharedError = err?.message || "Failed to load billing";
      // Keep last good snapshot if we already had one; otherwise stay null.
      if (!sharedBilling) {
        notifyListeners();
      } else {
        notifyListeners();
      }
      throw err;
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

/** Publish a /billing/me payload (e.g. after checkout return). Prefer refresh(). */
export function setBillingCache(data) {
  sharedBilling = data ?? null;
  sharedError = null;
  notifyListeners();
}

/** Clear cache and reload if any consumer is still mounted. */
export function invalidateBillingCache() {
  sharedBilling = null;
  sharedError = null;
  inflight = null;
  notifyListeners();
  if (sharedListeners.size > 0) {
    void loadSharedBilling().catch(() => {});
  }
}

/**
 * Sole React entry-point for subscription UI state.
 * Sidebar, BillingPage, badges — all must use this hook (same module cache).
 */
export function useBillingSummary({ enabled = true } = {}) {
  const { t, lang } = useDashboardLang();
  const [billing, setBilling] = useState(sharedBilling);
  const [error, setError] = useState(sharedError);
  const [loading, setLoading] = useState(enabled && !sharedBilling);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await loadSharedBilling();
      setBilling(data);
      setError(null);
      return data;
    } catch (err) {
      setError(err?.message || sharedError || "Failed to load billing");
      return sharedBilling;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!enabled) return undefined;

    const listener = ({ billing: next, error: nextError }) => {
      setBilling(next);
      setError(nextError);
      if (next) setLoading(false);
    };
    sharedListeners.add(listener);
    if (sharedBilling) {
      setBilling(sharedBilling);
      setError(sharedError);
      setLoading(false);
    } else {
      refresh();
    }

    return () => {
      sharedListeners.delete(listener);
    };
  }, [enabled, refresh]);

  const view = useMemo(() => buildBillingViewModel(billing, t, lang), [billing, t, lang]);

  return {
    billing,
    view,
    loading,
    error,
    refresh,
  };
}
