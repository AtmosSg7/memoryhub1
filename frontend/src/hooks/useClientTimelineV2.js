import { useCallback, useEffect, useState } from "react";
import { getClientTimelineV2 } from "@/lib/clientsApi";
import { useAddClient } from "@/context/AddClientContext";
import { useAddNote } from "@/context/AddNoteContext";
import { useDocumentsContext } from "@/context/DocumentsContext";
import { useAddQuote } from "@/context/AddQuoteContext";
import { useAddInvoice } from "@/context/AddInvoiceContext";
import { useFollowUpContext } from "@/context/FollowUpContext";

const DEFAULT_PAGE_SIZE = 40;

/**
 * Progressive Timeline V2 loader with category filter.
 */
export function useClientTimelineV2(
  clientId,
  { pageSize = DEFAULT_PAGE_SIZE, category = "all", enabled = true } = {}
) {
  const { refreshKey: clientsRefreshKey } = useAddClient();
  const { refreshKey: notesRefreshKey } = useAddNote();
  const { refreshKey: documentsRefreshKey } = useDocumentsContext();
  const { refreshKey: quotesRefreshKey } = useAddQuote();
  const { refreshKey: invoicesRefreshKey } = useAddInvoice();
  const { refreshKey: followUpsRefreshKey } = useFollowUpContext();

  const [items, setItems] = useState([]);
  const [summary, setSummary] = useState(null);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(Boolean(enabled));
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [activeCategory, setActiveCategory] = useState(category);

  useEffect(() => {
    setActiveCategory(category);
  }, [category]);

  const refetch = useCallback(async () => {
    if (!clientId || !enabled) {
      setItems([]);
      setSummary(null);
      setTotal(0);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await getClientTimelineV2(clientId, {
        limit: pageSize,
        offset: 0,
        category: activeCategory,
      });
      setItems(data.items || []);
      setSummary(data.summary || null);
      setTotal(data.total ?? 0);
    } catch (err) {
      setError(err.message || "Failed to load timeline.");
      setItems([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [clientId, enabled, pageSize, activeCategory]);

  const loadMore = useCallback(async () => {
    if (!clientId || !enabled || loadingMore) return;
    if (items.length >= total) return;
    setLoadingMore(true);
    try {
      const data = await getClientTimelineV2(clientId, {
        limit: pageSize,
        offset: items.length,
        category: activeCategory,
      });
      const next = data.items || [];
      setItems((prev) => {
        const seen = new Set(prev.map((i) => i.id));
        const merged = [...prev];
        for (const item of next) {
          if (!seen.has(item.id)) merged.push(item);
        }
        return merged;
      });
      setTotal(data.total ?? total);
      if (data.summary) setSummary(data.summary);
    } catch (err) {
      setError(err.message || "Failed to load timeline.");
    } finally {
      setLoadingMore(false);
    }
  }, [clientId, enabled, loadingMore, items.length, total, pageSize, activeCategory]);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    refetch();
  }, [
    enabled,
    refetch,
    clientsRefreshKey,
    notesRefreshKey,
    documentsRefreshKey,
    quotesRefreshKey,
    invoicesRefreshKey,
    followUpsRefreshKey,
  ]);

  return {
    items,
    summary,
    total,
    loading,
    loadingMore,
    error,
    refetch,
    loadMore,
    hasMore: items.length < total,
    category: activeCategory,
    setCategory: setActiveCategory,
  };
}
