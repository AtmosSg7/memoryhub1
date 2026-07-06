import { useCallback, useEffect, useState } from "react";
import { fetchPortalOverview } from "@/lib/portalApi";

export function usePortal(token) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    if (!token) {
      setLoading(false);
      setError("missing_token");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const overview = await fetchPortalOverview(token);
      setData(overview);
    } catch (err) {
      setData(null);
      setError(err.message || "load_error");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  return {
    data,
    loading,
    error,
    reload: load,
    patchQuote: (updatedQuote) => {
      setData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          quotes: prev.quotes.map((q) => (q.id === updatedQuote.id ? updatedQuote : q)),
        };
      });
    },
  };
}
