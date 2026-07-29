import { memo, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useDashboardLang } from "@/hooks/useDashboardLang";
import DashboardKpiCard from "@/components/dashboard/DashboardKpiCard";
import { MetricCardsSkeleton } from "@/components/dashboard/PageFeedback";
import { formatTrendPercent } from "@/utils/dashboardAnalytics";
import { commercialDocumentsPath } from "@/utils/commercialDocumentsPath";

function DashboardKpiGrid({ kpis, loading, periodMeta }) {
  const { t } = useDashboardLang();
  const navigate = useNavigate();
  const periodArgs = useMemo(
    () => (periodMeta?.from && periodMeta?.to ? { from: periodMeta.from, to: periodMeta.to } : {}),
    [periodMeta]
  );

  const cards = useMemo(() => {
    if (!kpis) return [];
    const trend = formatTrendPercent(kpis.revenue.trendPercent);
    const trendTone =
      kpis.revenue.trendPercent == null
        ? "neutral"
        : kpis.revenue.trendPercent >= 0
          ? "positive"
          : "negative";

    return [
      {
        id: "revenue",
        label: t("dashboardV2.kpi.revenue"),
        value: kpis.revenue.formatted,
        helper: t("dashboardV2.kpi.revenueHelper"),
        trend,
        trendTone,
        infoText: t("dashboardV2.kpi.hints.revenue"),
        onClick: () =>
          navigate(commercialDocumentsPath({ kind: "invoice", status: "paid", ...periodArgs })),
        testId: "dashboard-kpi-revenue",
      },
      {
        id: "clients",
        label: t("dashboardV2.kpi.clients"),
        value: kpis.clients.total,
        helper: t("dashboardV2.kpi.clientsHelper").replace(
          "{count}",
          String(kpis.clients.newThisMonth)
        ),
        infoText: t("dashboardV2.kpi.hints.clients"),
        onClick: () => navigate("/dashboard/clients"),
        testId: "dashboard-kpi-clients",
      },
      {
        id: "quotes",
        label: t("dashboardV2.kpi.quotes"),
        value: kpis.quotes.pending,
        helper: t("dashboardV2.kpi.quotesHelper").replace(
          "{count}",
          String(kpis.quotes.accepted)
        ),
        infoText: t("dashboardV2.kpi.hints.quotes"),
        onClick: () =>
          navigate(commercialDocumentsPath({ kind: "quote", status: "sent", ...periodArgs })),
        testId: "dashboard-kpi-quotes",
      },
      {
        id: "invoices",
        label: t("dashboardV2.kpi.invoices"),
        value: kpis.invoices.paid,
        helper: t("dashboardV2.kpi.invoicesHelper").replace(
          "{count}",
          String(kpis.invoices.pending)
        ),
        infoText: t("dashboardV2.kpi.hints.invoices"),
        onClick: () =>
          navigate(commercialDocumentsPath({ kind: "invoice", status: "paid", ...periodArgs })),
        testId: "dashboard-kpi-invoices",
      },
    ];
  }, [kpis, navigate, t, periodArgs]);

  if (loading) {
    return (
      <section data-testid="dashboard-kpi-loading" aria-busy="true">
        <MetricCardsSkeleton count={4} testId="dashboard-kpi-skeleton" />
      </section>
    );
  }

  return (
    <section
      className="grid grid-cols-2 xl:grid-cols-4 gap-3 md:gap-4"
      data-testid="dashboard-kpi-grid"
      aria-label={t("dashboardV2.kpi.sectionLabel")}
    >
      {cards.map((card) => (
        <DashboardKpiCard key={card.id} {...card} />
      ))}
    </section>
  );
}

export default memo(DashboardKpiGrid);
