import { useMemo } from "react";
import { useDashboardStats } from "@/hooks/useDashboardStats";
import { useDocuments } from "@/hooks/useDocuments";

export function useDashboardOverview() {
  const stats = useDashboardStats();
  const { total: documentsTotal, loading: documentsLoading } = useDocuments();

  const loading = stats.loading || documentsLoading;

  const onboarding = useMemo(
    () => ({
      needsClient: stats.kpis.clientsTotal === 0,
      needsQuote: stats.kpis.quotesTotal === 0,
      needsInvoice: stats.kpis.invoicesTotal === 0,
      needsImport: documentsTotal === 0,
    }),
    [stats.kpis.clientsTotal, stats.kpis.quotesTotal, stats.kpis.invoicesTotal, documentsTotal]
  );

  const isEmptyAccount = useMemo(
    () =>
      !loading &&
      stats.kpis.clientsTotal === 0 &&
      stats.kpis.quotesTotal === 0 &&
      stats.kpis.invoicesTotal === 0 &&
      documentsTotal === 0,
    [loading, stats.kpis, documentsTotal]
  );

  const hasOnboardingSteps = useMemo(
    () => Object.values(onboarding).some(Boolean),
    [onboarding]
  );

  return {
    ...stats,
    documentsTotal,
    loading,
    onboarding,
    isEmptyAccount,
    hasOnboardingSteps,
  };
}
