import { useCallback, useEffect, useState } from "react";
import {
  getUnlinkedEmailCount,
  listUnlinkedEmails,
} from "@/lib/communicationsApi";

const PAGE_SIZE = 20;

export function useUnlinkedEmails(linkStatus = "unlinked", { enabled = true } = {}) {
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(Boolean(enabled));
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [unlinkedCount, setUnlinkedCount] = useState(0);

  const loadCount = useCallback(async () => {
    try {
      const data = await getUnlinkedEmailCount();
      setUnlinkedCount(data.total ?? 0);
    } catch {
      /* ignore badge errors */
    }
  }, []);

  const refetch = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    setError(null);
    setOffset(0);
    try {
      const data = await listUnlinkedEmails({
        limit: PAGE_SIZE,
        offset: 0,
        linkStatus,
      });
      setItems(data.items || []);
      setTotal(data.total ?? 0);
      await loadCount();
    } catch (err) {
      setError(err.message || "Failed to load emails.");
      setItems([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [enabled, linkStatus, loadCount]);

  const loadMore = useCallback(async () => {
    if (!enabled || loadingMore || items.length >= total) return;
    setLoadingMore(true);
    try {
      const nextOffset = items.length;
      const data = await listUnlinkedEmails({
        limit: PAGE_SIZE,
        offset: nextOffset,
        linkStatus,
      });
      setItems((prev) => [...prev, ...(data.items || [])]);
      setTotal(data.total ?? 0);
      setOffset(nextOffset);
    } catch (err) {
      setError(err.message || "Failed to load more.");
    } finally {
      setLoadingMore(false);
    }
  }, [enabled, items.length, linkStatus, loadingMore, total]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  useEffect(() => {
    loadCount();
  }, [loadCount]);

  return {
    items,
    total,
    unlinkedCount,
    loading,
    loadingMore,
    error,
    hasMore: items.length < total,
    refetch,
    loadMore,
    pageSize: PAGE_SIZE,
    offset,
  };
}
