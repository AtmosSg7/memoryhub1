import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { listInvoices } from "@/lib/invoicesApi";
import { useAddInvoice } from "@/context/AddInvoiceContext";
import { invalidateCommercialQueries } from "@/utils/invalidateCommercialQueries";

export function useInvoices(statusFilter = "", options = {}) {
  const { refreshKey } = useAddInvoice();
  const queryClient = useQueryClient();
  const clientId = options.clientId || "";
  const from = options.from || "";
  const to = options.to || "";
  const timezone = options.timezone || "";
  const enabled = options.enabled !== false;

  const query = useQuery({
    queryKey: [
      "invoices",
      statusFilter || "all",
      clientId || "all",
      from || "-",
      to || "-",
      timezone || "-",
    ],
    queryFn: () =>
      listInvoices({
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
    invoices: query.data?.items || [],
    total: query.data?.total ?? 0,
    loading: query.isLoading,
    error: query.error?.message || null,
    refetch: query.refetch,
  };
}
