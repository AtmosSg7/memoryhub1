import { useCallback, useEffect, useState } from "react";
import { listClients } from "@/lib/clientsApi";
import { useAddClient } from "@/context/AddClientContext";

export function useClients() {
  const { refreshKey } = useAddClient();
  const [clients, setClients] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listClients();
      setClients(data.items || []);
      setTotal(data.total ?? 0);
    } catch (err) {
      setError(err.message || "Failed to load clients.");
      setClients([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refetch();
  }, [refetch, refreshKey]);

  return { clients, total, loading, error, refetch };
}
