import { useCallback, useEffect, useState } from "react";
import { getProspectsCount } from "@/lib/prospectsApi";

const TTL_MS = 60_000;
let cache = { total: null, fetchedAt: 0, inFlight: null };
const listeners = new Set();

function notify(total) {
  listeners.forEach((fn) => fn(total));
}

export function invalidateProspectsPendingCount() {
  cache = { total: null, fetchedAt: 0, inFlight: null };
}

async function fetchPendingCount({ force = false } = {}) {
  const now = Date.now();
  if (!force && cache.total != null && now - cache.fetchedAt < TTL_MS) {
    return cache.total;
  }
  if (cache.inFlight) return cache.inFlight;

  cache.inFlight = getProspectsCount({ status: "pending" })
    .then((data) => {
      const total = data.total ?? 0;
      cache = { total, fetchedAt: Date.now(), inFlight: null };
      notify(total);
      return total;
    })
    .catch((err) => {
      cache.inFlight = null;
      throw err;
    });

  return cache.inFlight;
}

/**
 * Shared pending prospects count for sidebar badge + page header.
 * Dedupes concurrent callers and caches for 60s.
 */
export function useProspectsPendingCount({ enabled = true } = {}) {
  const [total, setTotal] = useState(() => cache.total ?? 0);
  const [loading, setLoading] = useState(enabled && cache.total == null);

  const refresh = useCallback(
    async ({ force = false } = {}) => {
      if (!enabled) return 0;
      setLoading(cache.total == null);
      try {
        const next = await fetchPendingCount({ force });
        setTotal(next);
        return next;
      } catch {
        return cache.total ?? 0;
      } finally {
        setLoading(false);
      }
    },
    [enabled]
  );

  useEffect(() => {
    if (!enabled) return undefined;
    const onUpdate = (value) => setTotal(value);
    listeners.add(onUpdate);
    refresh();
    return () => listeners.delete(onUpdate);
  }, [enabled, refresh]);

  return { total, loading, refresh };
}
