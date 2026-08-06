import { useCallback, useEffect, useMemo, useState } from "react";
import { listProspects } from "@/lib/prospectsApi";
import {
  invalidateProspectsPendingCount,
  useProspectsPendingCount,
} from "@/hooks/useProspectsPendingCount";

const PAGE_SIZE = 20;

/** @typedef {'pending'|'ignored'|'treated'|'automatic'} ProspectTab */

function sortByLastContact(items) {
  return [...items].sort((a, b) =>
    String(b.lastContactAt || "").localeCompare(String(a.lastContactAt || ""))
  );
}

async function fetchTreatedPage({ limit, offset }) {
  const [associated, converted] = await Promise.all([
    listProspects({ status: "associated", limit: 100, offset: 0 }),
    listProspects({ status: "converted", limit: 100, offset: 0 }),
  ]);
  const merged = sortByLastContact([...(associated.items || []), ...(converted.items || [])]);
  const total = (associated.total ?? 0) + (converted.total ?? 0);
  return {
    items: merged.slice(offset, offset + limit),
    total: Math.max(total, merged.length),
  };
}

/**
 * @param {ProspectTab} tab
 * @param {{ enabled?: boolean }} [opts]
 */
export function useProspects(tab = "pending", { enabled = true } = {}) {
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(Boolean(enabled));
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const { total: pendingCount, refresh: refreshPendingCount } = useProspectsPendingCount({
    enabled,
  });

  const apiStatus = useMemo(() => {
    if (tab === "treated") return "treated";
    if (tab === "automatic") return "automatic";
    if (tab === "ignored") return "ignored";
    return "pending";
  }, [tab]);

  const refetch = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    setError(null);
    try {
      let data;
      if (apiStatus === "treated") {
        data = await fetchTreatedPage({ limit: PAGE_SIZE, offset: 0 });
      } else {
        data = await listProspects({
          limit: PAGE_SIZE,
          offset: 0,
          status: apiStatus,
          includeAutomatic: apiStatus === "automatic",
        });
      }
      setItems(data.items || []);
      setTotal(data.total ?? 0);
      invalidateProspectsPendingCount();
      await refreshPendingCount({ force: true });
    } catch (err) {
      setError(err.message || "Failed to load prospects.");
      setItems([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [apiStatus, enabled, refreshPendingCount]);

  const loadMore = useCallback(async () => {
    if (!enabled || loadingMore || items.length >= total) return;
    setLoadingMore(true);
    try {
      const nextOffset = items.length;
      let data;
      if (apiStatus === "treated") {
        data = await fetchTreatedPage({ limit: PAGE_SIZE, offset: nextOffset });
        setItems((prev) => {
          const seen = new Set(prev.map((p) => p.id));
          const next = (data.items || []).filter((p) => !seen.has(p.id));
          return [...prev, ...next];
        });
      } else {
        data = await listProspects({
          limit: PAGE_SIZE,
          offset: nextOffset,
          status: apiStatus,
          includeAutomatic: apiStatus === "automatic",
        });
        setItems((prev) => [...prev, ...(data.items || [])]);
      }
      setTotal(data.total ?? 0);
    } catch (err) {
      setError(err.message || "Failed to load more.");
    } finally {
      setLoadingMore(false);
    }
  }, [apiStatus, enabled, items.length, loadingMore, total]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return {
    items,
    total,
    pendingCount,
    loading,
    loadingMore,
    error,
    hasMore: items.length < total,
    refetch,
    loadMore,
    pageSize: PAGE_SIZE,
  };
}
