import { useMemo } from "react";
import { useDashboardOverview } from "@/hooks/useDashboardOverview";
import { useAnalyticsOverview } from "@/hooks/useAnalyticsOverview";
import { mapAnalyticsToDashboardHome } from "@/utils/mapAnalyticsOverview";
import { formatInvoiceAmount } from "@/utils/invoiceDisplay";

function fallbackFromOverview(overview, lang) {
  const monthly = overview.kpis?.monthlyRevenue?.total ?? 0;
  return {
    kpis: {
      revenue: {
        value: monthly,
        formatted: formatInvoiceAmount(monthly, lang),
        trendPercent: null,
        helperCount: overview.kpis?.monthlyRevenue?.count ?? 0,
      },
      clients: {
        total: overview.kpis?.clientsTotal ?? 0,
        newThisMonth: 0,
      },
      quotes: {
        pending: overview.kpis?.pendingQuotes ?? 0,
        accepted: 0,
        total: overview.kpis?.quotesTotal ?? 0,
      },
      invoices: {
        paid: 0,
        pending: overview.kpis?.unpaidInvoices ?? 0,
        total: overview.kpis?.invoicesTotal ?? 0,
      },
    },
    pipeline: { quotes: {}, invoices: {} },
    series: [],
    topClients: (overview.topClients || []).map((row) => ({
      ...row,
      lastContactAt: row.lastContactAt || null,
    })),
  };
}

/**
 * Shared dashboard data spine — analytics overview for KPIs/charts/pipeline,
 * plus lightweight overview stats for onboarding emptiness.
 */
export function useDashboardHomeData({ lang = "fr", period = "30d", enabled = true } = {}) {
  const overview = useDashboardOverview();
  const analytics = useAnalyticsOverview({
    period,
    sort: "collected",
    enabled,
  });

  const loading = overview.loading || analytics.loading;

  const mapped = useMemo(() => {
    if (analytics.data) {
      return mapAnalyticsToDashboardHome(analytics.data, {
        lang,
        clientsTotal: overview.kpis.clientsTotal,
      });
    }
    if (!analytics.loading) {
      return fallbackFromOverview(overview, lang);
    }
    return mapAnalyticsToDashboardHome(null, {
      lang,
      clientsTotal: overview.kpis.clientsTotal,
    });
  }, [analytics.data, analytics.loading, lang, overview]);

  return {
    kpis: mapped.kpis,
    pipeline: mapped.pipeline,
    series: mapped.series,
    topClients: mapped.topClients,
    periodMeta: analytics.data?.period
      ? { from: analytics.data.period.fromDate, to: analytics.data.period.toDate, key: analytics.data.period.key }
      : null,
    emptyAnalytics: Boolean(analytics.data?.empty),
    loading,
    statsLoading: overview.loading,
    listsLoading: analytics.loading,
    onboarding: overview.onboarding,
    isEmptyAccount: overview.isEmptyAccount,
    hasOnboardingSteps: overview.hasOnboardingSteps,
    clientsTotal: overview.kpis.clientsTotal,
    error: analytics.error || overview.error,
    refetch: () => {
      overview.refetch();
      analytics.refetch();
    },
  };
}
