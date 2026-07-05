import { useCallback, useEffect, useState } from "react";
import { getClient } from "@/lib/clientsApi";
import { useAddClient } from "@/context/AddClientContext";

export function useClient(clientId) {
  const { refreshKey } = useAddClient();
  const [client, setClient] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refetch = useCallback(async () => {
    if (!clientId) {
      setClient(null);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const data = await getClient(clientId);
      setClient(data);
    } catch (err) {
      setError(err.message || "Failed to load client.");
      setClient(null);
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    refetch();
  }, [refetch, refreshKey]);

  return { client, loading, error, refetch };
}
