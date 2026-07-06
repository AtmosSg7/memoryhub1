import { useCallback, useEffect, useState } from "react";
import { listCommunications } from "@/lib/communicationsApi";
import { useAddClient } from "@/context/AddClientContext";
import { useAddNote } from "@/context/AddNoteContext";
import { useAddQuote } from "@/context/AddQuoteContext";
import { useAddInvoice } from "@/context/AddInvoiceContext";
import { useFollowUpContext } from "@/context/FollowUpContext";

export function useCommunications({ clientId = "", category = "", limit = 50 } = {}) {
  const { refreshKey: clientsRefreshKey } = useAddClient();
  const { refreshKey: notesRefreshKey } = useAddNote();
  const { refreshKey: quotesRefreshKey } = useAddQuote();
  const { refreshKey: invoicesRefreshKey } = useAddInvoice();
  const { refreshKey: followUpsRefreshKey } = useFollowUpContext();

  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [emailIntegrationReady, setEmailIntegrationReady] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listCommunications({
        clientId: clientId || undefined,
        category: category || undefined,
        limit,
      });
      setItems(data.items || []);
      setTotal(data.total ?? 0);
      setEmailIntegrationReady(Boolean(data.emailIntegrationReady));
    } catch (err) {
      setError(err.message || "Failed to load communications.");
      setItems([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [clientId, category, limit]);

  useEffect(() => {
    refetch();
  }, [refetch, clientsRefreshKey, notesRefreshKey, quotesRefreshKey, invoicesRefreshKey, followUpsRefreshKey]);

  return { items, total, emailIntegrationReady, loading, error, refetch };
}
