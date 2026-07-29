import { useQuery } from "@tanstack/react-query";
import { getAnalyticsOverview } from "@/lib/analyticsApi";
import { resolveAnalyticsTimezone } from "@/utils/analyticsPeriod";

export function useAnalyticsOverview({
  period = "30d",
  from = "",
  to = "",
  timezone,
  sort = "collected",
  enabled = true,
} = {}) {
  const resolvedTimezone = timezone || resolveAnalyticsTimezone();

  const query = useQuery({
    queryKey: ["analytics-overview", period, from || null, to || null, resolvedTimezone, sort],
    queryFn: () =>
      getAnalyticsOverview({
        period,
        from: period === "custom" ? from || undefined : undefined,
        to: period === "custom" ? to || undefined : undefined,
        timezone: resolvedTimezone,
        sort,
      }),
    staleTime: 30_000,
    enabled,
  });

  return {
    data: query.data ?? null,
    loading: query.isLoading,
    fetching: query.isFetching,
    error: query.error?.message || null,
    refetch: query.refetch,
  };
}
