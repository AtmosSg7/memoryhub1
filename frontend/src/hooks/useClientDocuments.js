import { useCallback, useEffect, useState } from "react";
import { listDocuments } from "@/lib/documentsApi";
import { useDocumentsContext } from "@/context/DocumentsContext";

export function useClientDocuments(clientId) {
  const { refreshKey } = useDocumentsContext();
  const [documents, setDocuments] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refetch = useCallback(async () => {
    if (!clientId) {
      setDocuments([]);
      setTotal(0);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const data = await listDocuments(clientId);
      setDocuments(data.items || []);
      setTotal(data.total ?? 0);
    } catch (err) {
      setError(err.message || "Failed to load documents.");
      setDocuments([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    refetch();
  }, [refetch, refreshKey]);

  return { documents, total, loading, error, refetch };
}
