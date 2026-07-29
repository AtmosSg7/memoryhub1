import { useCallback, useEffect, useState } from "react";
import { getIntelligenceOverview } from "@/lib/intelligenceApi";

export function useIntelligenceOverview({ enabled = true, force = false } = {}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(Boolean(enabled));
  const [error, setError] = useState(null);

  const refetch = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    setError(null);
    try {
      const payload = await getIntelligenceOverview({ force });
      setData(payload);
    } catch (err) {
      setError(err.message || "Failed to load intelligence.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [enabled, force]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { data, loading, error, refetch };
}
