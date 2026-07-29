import { useCallback, useEffect, useState } from "react";
import { listQuotes } from "@/lib/quotesApi";
import { useAddQuote } from "@/context/AddQuoteContext";

export function useClientQuotes(clientId, statusFilter = "", { enabled = true } = {}) {
  const { refreshKey } = useAddQuote();
  const [quotes, setQuotes] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refetch = useCallback(async () => {
    if (!clientId || !enabled) {
      setQuotes([]);
      setTotal(0);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await listQuotes({
        clientId,
        status: statusFilter || undefined,
      });
      setQuotes(data.items || []);
      setTotal(data.total ?? 0);
    } catch (err) {
      setError(err.message || "Failed to load quotes.");
      setQuotes([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [clientId, statusFilter, enabled]);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    refetch();
  }, [enabled, refetch, refreshKey]);

  return { quotes, total, loading, error, refetch };
}
