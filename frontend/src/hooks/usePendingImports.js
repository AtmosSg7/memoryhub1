import { useCallback, useEffect, useState } from "react";
import { listImports } from "@/lib/importApi";
import { useDocumentsContext } from "@/context/DocumentsContext";

export function usePendingImports(limit = 20) {
  const { refreshKey } = useDocumentsContext();
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listImports({ limit });
      const pending = (data.items || []).filter((session) => session.status === "pending");
      setSessions(pending);
    } catch (err) {
      setError(err.message || "Failed to load imports.");
      setSessions([]);
    } finally {
      setLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    refetch();
  }, [refetch, refreshKey]);

  return { sessions, loading, error, refetch };
}
