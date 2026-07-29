import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { listQuotes } from "@/lib/quotesApi";
import { useAddQuote } from "@/context/AddQuoteContext";
import { invalidateCommercialQueries } from "@/utils/invalidateCommercialQueries";

export function useQuotes(statusFilter = "", filters = {}) {
  const { refreshKey } = useAddQuote();
  const queryClient = useQueryClient();
  const clientId = filters.clientId || "";
  const from = filters.from || "";
  const to = filters.to || "";
  const timezone = filters.timezone || "";
  const enabled = filters.enabled !== false;

  const query = useQuery({
    queryKey: ["quotes", statusFilter || "all", clientId || "all", from || "-", to || "-", timezone || "-"],
    queryFn: () =>
      listQuotes({
        status: statusFilter || undefined,
        clientId: clientId || undefined,
        from: from || undefined,
        to: to || undefined,
        timezone: timezone || undefined,
      }),
    staleTime: 60_000,
    enabled,
  });

  useEffect(() => {
    if (refreshKey > 0) {
      invalidateCommercialQueries(queryClient);
    }
  }, [refreshKey, queryClient]);

  return {
    quotes: query.data?.items || [],
    total: query.data?.total ?? 0,
    loading: query.isLoading,
    error: query.error?.message || null,
    refetch: query.refetch,
  };
}
