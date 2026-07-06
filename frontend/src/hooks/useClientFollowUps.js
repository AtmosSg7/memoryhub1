import { useCallback, useEffect, useState } from "react";
import { listFollowUps } from "@/lib/followUpsApi";
import { useFollowUpContext } from "@/context/FollowUpContext";

export function useClientFollowUps(clientId, limit = 20) {
  const { refreshKey } = useFollowUpContext();
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refetch = useCallback(async () => {
    if (!clientId) {
      setItems([]);
      setTotal(0);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await listFollowUps({ clientId, limit });
      setItems(data.items || []);
      setTotal(data.total ?? 0);
    } catch (err) {
      setError(err.message || "Failed to load follow-ups.");
      setItems([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [clientId, limit]);

  useEffect(() => {
    refetch();
  }, [refetch, refreshKey]);

  return { items, total, loading, error, refetch };
}
