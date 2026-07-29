/**
 * Cross-invalidate commercial React Query caches after mutations.
 * Dashboard / Analytics stale windows otherwise leave KPIs out of date.
 */
export function invalidateCommercialQueries(queryClient) {
  if (!queryClient) return;
  queryClient.invalidateQueries({ queryKey: ["quotes"] });
  queryClient.invalidateQueries({ queryKey: ["invoices"] });
  queryClient.invalidateQueries({ queryKey: ["clients"] });
  queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
  queryClient.invalidateQueries({ queryKey: ["analytics-overview"] });
  queryClient.invalidateQueries({ queryKey: ["intelligence-overview"] });
}
