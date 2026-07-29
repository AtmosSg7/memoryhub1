import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { listClients } from "@/lib/clientsApi";
import { useAddClient } from "@/context/AddClientContext";
import { invalidateCommercialQueries } from "@/utils/invalidateCommercialQueries";

export function useClients({ enabled = true } = {}) {
  const { refreshKey } = useAddClient();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["clients"],
    queryFn: listClients,
    enabled,
    staleTime: 60_000,
  });

  useEffect(() => {
    if (refreshKey > 0) {
      invalidateCommercialQueries(queryClient);
    }
  }, [refreshKey, queryClient]);

  return {
    clients: query.data?.items || [],
    total: query.data?.total ?? 0,
    loading: query.isLoading,
    error: query.error?.message || null,
    refetch: query.refetch,
  };
}
