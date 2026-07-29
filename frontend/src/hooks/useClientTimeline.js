import { useCallback, useEffect, useState } from "react";
import { listClientEvents } from "@/lib/eventsApi";
import { useAddClient } from "@/context/AddClientContext";
import { useAddNote } from "@/context/AddNoteContext";
import { useDocumentsContext } from "@/context/DocumentsContext";
import { useAddQuote } from "@/context/AddQuoteContext";
import { useAddInvoice } from "@/context/AddInvoiceContext";
import { useFollowUpContext } from "@/context/FollowUpContext";

const DEFAULT_PAGE_SIZE = 40;

export function useClientTimeline(
  clientId,
  limitOrOptions = DEFAULT_PAGE_SIZE,
  maybeOptions = {},
) {
  // Backward compatible: useClientTimeline(id, 100) or useClientTimeline(id, { pageSize: 40 })
  const options =
    typeof limitOrOptions === "object" && limitOrOptions !== null
      ? limitOrOptions
      : maybeOptions;
  const pageSize =
    typeof limitOrOptions === "number"
      ? limitOrOptions
      : options.pageSize || DEFAULT_PAGE_SIZE;
  const enabled = options.enabled !== false;

  const { refreshKey: clientsRefreshKey } = useAddClient();
  const { refreshKey: notesRefreshKey } = useAddNote();
  const { refreshKey: documentsRefreshKey } = useDocumentsContext();
  const { refreshKey: quotesRefreshKey } = useAddQuote();
  const { refreshKey: invoicesRefreshKey } = useAddInvoice();
  const { refreshKey: followUpsRefreshKey } = useFollowUpContext();

  const [events, setEvents] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);

  const refetch = useCallback(async () => {
    if (!clientId || !enabled) {
      setEvents([]);
      setTotal(0);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const data = await listClientEvents(clientId, { limit: pageSize, offset: 0 });
      setEvents(data.items || []);
      setTotal(data.total ?? 0);
    } catch (err) {
      setError(err.message || "Failed to load timeline.");
      setEvents([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [clientId, pageSize, enabled]);

  const loadMore = useCallback(async () => {
    if (!clientId || !enabled || loadingMore) return;
    if (events.length >= total) return;

    setLoadingMore(true);
    setError(null);
    try {
      const data = await listClientEvents(clientId, {
        limit: pageSize,
        offset: events.length,
      });
      const nextItems = data.items || [];
      setEvents((prev) => {
        const seen = new Set(prev.map((event) => event.id));
        const merged = [...prev];
        for (const item of nextItems) {
          if (!seen.has(item.id)) merged.push(item);
        }
        return merged;
      });
      setTotal(data.total ?? total);
    } catch (err) {
      setError(err.message || "Failed to load timeline.");
    } finally {
      setLoadingMore(false);
    }
  }, [clientId, enabled, loadingMore, events.length, total, pageSize]);

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
    events,
    total,
    loading,
    loadingMore,
    error,
    refetch,
    loadMore,
    hasMore: events.length < total,
  };
}
