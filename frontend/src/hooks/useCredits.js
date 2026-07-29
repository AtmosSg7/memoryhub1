import { useCallback, useEffect, useState } from "react";
import { fetchCreditBalance } from "@/lib/creditsApi";

let sharedBalance = null;
let sharedListeners = new Set();
let inflight = null;

function notifyListeners() {
  sharedListeners.forEach((listener) => listener(sharedBalance));
}

async function loadSharedBalance() {
  if (inflight) return inflight;
  inflight = fetchCreditBalance()
    .then((data) => {
      sharedBalance = data;
      notifyListeners();
      return data;
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

export function useCredits({ enabled = true } = {}) {
  const [balance, setBalance] = useState(sharedBalance);
  const [loading, setLoading] = useState(enabled && !sharedBalance);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await loadSharedBalance();
      setBalance(data);
      return data;
    } catch (err) {
      setError(err.message || "Failed to load analyses.");
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!enabled) return undefined;

    const listener = (next) => setBalance(next);
    sharedListeners.add(listener);
    if (sharedBalance) {
      setBalance(sharedBalance);
      setLoading(false);
    } else {
      refresh().catch(() => {});
    }

    return () => {
      sharedListeners.delete(listener);
    };
  }, [enabled, refresh]);

  return {
    balance,
    totalRemaining: balance?.totalRemaining ?? null,
    monthlyRemaining: balance?.monthlyRemaining ?? null,
    permanentRemaining: balance?.permanentRemaining ?? null,
    loading,
    error,
    refresh,
  };
}

export function invalidateCreditsCache() {
  sharedBalance = null;
  notifyListeners();
}
