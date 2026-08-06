import { useCallback, useEffect, useState } from "react";
import { getActionsCount, listActions } from "@/lib/actionsApi";
import { subscribeActionsPendingCount } from "@/hooks/useActionsCountInvalidate";

/**
 * Load Action Engine items for the dashboard Action Center.
 * @param {{ status?: string, type?: string, clientId?: string, limit?: number, enabled?: boolean }} [opts]
 */
export function useActions({
  status = "pending",
  type,
  clientId,
  limit = 50,
  enabled = true,
} = {}) {
  const [actions, setActions] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(Boolean(enabled));
  const [error, setError] = useState(null);

  const refetch = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    setError(null);
    try {
      const data = await listActions({ status, type, clientId, limit });
      setActions(data.items || []);
      setTotal(data.total ?? 0);
    } catch (err) {
      setError(err.message || "Failed to load actions.");
      setActions([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [status, type, clientId, limit, enabled]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { actions, total, loading, error, refetch };
}

/** @param {{ status?: string, enabled?: boolean }} [opts] */
export function useActionsCount({ status = "pending", enabled = true } = {}) {
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(Boolean(enabled));
  const [error, setError] = useState(null);

  const refetch = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getActionsCount({ status });
      setTotal(data.total ?? 0);
    } catch (err) {
      setError(err.message || "Failed to load actions count.");
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [status, enabled]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  useEffect(() => {
    if (!enabled) return undefined;
    return subscribeActionsPendingCount(() => {
      refetch();
    });
  }, [enabled, refetch]);

  return { total, loading, error, refetch };
}
