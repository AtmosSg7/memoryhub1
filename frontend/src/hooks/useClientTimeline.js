import { useCallback, useEffect, useState } from "react";
import { listClientEvents } from "@/lib/eventsApi";
import { useAddClient } from "@/context/AddClientContext";
import { useAddNote } from "@/context/AddNoteContext";
import { useDocumentsContext } from "@/context/DocumentsContext";
import { useAddQuote } from "@/context/AddQuoteContext";
import { useAddInvoice } from "@/context/AddInvoiceContext";
import { useFollowUpContext } from "@/context/FollowUpContext";

export function useClientTimeline(clientId, limit = 50) {
  const { refreshKey: clientsRefreshKey } = useAddClient();
  const { refreshKey: notesRefreshKey } = useAddNote();
  const { refreshKey: documentsRefreshKey } = useDocumentsContext();
  const { refreshKey: quotesRefreshKey } = useAddQuote();
  const { refreshKey: invoicesRefreshKey } = useAddInvoice();
  const { refreshKey: followUpsRefreshKey } = useFollowUpContext();

  const [events, setEvents] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refetch = useCallback(async () => {
    if (!clientId) {
      setEvents([]);
      setTotal(0);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const data = await listClientEvents(clientId, limit);
      setEvents(data.items || []);
      setTotal(data.total ?? 0);
    } catch (err) {
      setError(err.message || "Failed to load timeline.");
      setEvents([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [clientId, limit]);

  useEffect(() => {
    refetch();
  }, [refetch, clientsRefreshKey, notesRefreshKey, documentsRefreshKey, quotesRefreshKey, invoicesRefreshKey, followUpsRefreshKey]);

  return { events, total, loading, error, refetch };
}
