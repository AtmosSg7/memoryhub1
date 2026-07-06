import { useCallback, useEffect, useState } from "react";
import { listReminders } from "@/lib/remindersApi";
import { useAddClient } from "@/context/AddClientContext";
import { useAddNote } from "@/context/AddNoteContext";
import { useDocumentsContext } from "@/context/DocumentsContext";
import { useAddQuote } from "@/context/AddQuoteContext";
import { useAddInvoice } from "@/context/AddInvoiceContext";

export function useReminders(limit = 50) {
  const { refreshKey: clientsRefreshKey } = useAddClient();
  const { refreshKey: notesRefreshKey } = useAddNote();
  const { refreshKey: documentsRefreshKey } = useDocumentsContext();
  const { refreshKey: quotesRefreshKey } = useAddQuote();
  const { refreshKey: invoicesRefreshKey } = useAddInvoice();

  const [reminders, setReminders] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listReminders({ limit });
      setReminders(data.items || []);
      setTotal(data.total ?? 0);
    } catch (err) {
      setError(err.message || "Failed to load reminders.");
      setReminders([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    refetch();
  }, [
    refetch,
    clientsRefreshKey,
    notesRefreshKey,
    documentsRefreshKey,
    quotesRefreshKey,
    invoicesRefreshKey,
  ]);

  return { reminders, total, loading, error, refetch };
}
