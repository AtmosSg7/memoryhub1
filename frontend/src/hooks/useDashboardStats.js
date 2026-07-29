import { useQuery } from "@tanstack/react-query";
import { getDashboardStats } from "@/lib/dashboardApi";

export function useDashboardStats() {
  const query = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: getDashboardStats,
    staleTime: 60_000,
  });

  const data = query.data;

  return {
    kpis: {
      clientsTotal: data?.kpis?.clientsTotal ?? 0,
      pendingQuotes: data?.kpis?.pendingQuotes ?? 0,
      unpaidInvoices: data?.kpis?.unpaidInvoices ?? 0,
      quotesTotal: data?.kpis?.quotesTotal ?? 0,
      invoicesTotal: data?.kpis?.invoicesTotal ?? 0,
      monthlyRevenue: data?.kpis?.monthlyRevenue ?? { total: 0, count: 0 },
    },
    topClients: data?.topClients ?? [],
    topServices: [],
    loading: query.isLoading,
    error: query.error?.message || null,
    refetch: query.refetch,
  };
}
