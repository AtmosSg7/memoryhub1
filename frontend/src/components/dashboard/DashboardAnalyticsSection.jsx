import { memo, useMemo, lazy, Suspense } from "react";
import { Link, useNavigate } from "react-router-dom";
import { BarChart3 } from "lucide-react";
import { useDashboardLang } from "@/hooks/useDashboardLang";
import { ANALYTICS_PERIODS } from "@/utils/dashboardAnalytics";
import { formatInvoiceAmount } from "@/utils/invoiceDisplay";
import { Skeleton } from "@/components/ui/skeleton";
import EmptyState from "@/components/dashboard/EmptyState";

const DashboardAnalyticsCharts = lazy(() => import("./DashboardAnalyticsCharts"));

function ChartsSkeleton() {
  return (
    <div className="space-y-3" data-testid="dashboard-analytics-skeleton">
      <Skeleton className="h-4 w-40 bg-[#E5E7EB]" />
      <Skeleton className="h-56 w-full rounded-xl bg-[#F3F4F6]" />
    </div>
  );
}

function DashboardAnalyticsSection({ series, loading, period, onPeriodChange, empty }) {
  const { t, lang } = useDashboardLang();
  const navigate = useNavigate();

  const labels = useMemo(
    () => ({
      revenue: t("dashboardV2.analytics.revenueTitle"),
      documents: t("dashboardV2.analytics.documentsTitle"),
      clients: t("dashboardV2.analytics.clientsTitle"),
      revenueSeries: t("dashboardV2.analytics.revenueSeries"),
      quotes: t("dashboardV2.analytics.quotesSeries"),
      invoices: t("dashboardV2.analytics.invoicesSeries"),
      clientsSeries: t("dashboardV2.analytics.clientsSeries"),
    }),
    [t]
  );

  const formatCurrency = useMemo(() => (cents) => formatInvoiceAmount(cents, lang), [lang]);
  const hasSeriesData = (series || []).some(
    (point) => (point.revenue || 0) > 0 || (point.quotes || 0) > 0 || (point.invoices || 0) > 0
  );

  return (
    <section className="space-y-3" data-testid="dashboard-analytics-section">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#9CA3AF]">
            {t("dashboardV2.analytics.eyebrow")}
          </p>
          <h2 className="font-cabinet text-lg md:text-xl font-bold text-[#111827] tracking-tight mt-1">
            {t("dashboardV2.analytics.title")}
          </h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div
            className="inline-flex flex-wrap items-center gap-1 rounded-lg border border-[#E5E7EB] bg-white p-1"
            role="tablist"
            aria-label={t("dashboardV2.analytics.periodLabel")}
          >
            {ANALYTICS_PERIODS.map((key) => {
              const active = period === key;
              return (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => onPeriodChange?.(key)}
                  className={[
                    "px-2.5 py-1.5 rounded-md text-xs font-semibold transition-colors",
                    active
                      ? "bg-[#0A2540] text-white"
                      : "text-[#6B7280] hover:text-[#111827] hover:bg-[#F9FAFB]",
                  ].join(" ")}
                  data-testid={`dashboard-period-${key}`}
                >
                  {t(`dashboardV2.analytics.periods.${key}`)}
                </button>
              );
            })}
          </div>
          <Link
            to="/dashboard/analytics"
            className="text-xs font-semibold text-[#0A2540] hover:underline px-1"
            data-testid="dashboard-analytics-all-link"
          >
            {t("dashboardV2.analytics.viewAll")}
          </Link>
        </div>
      </div>

      {loading ? (
        <ChartsSkeleton />
      ) : empty || !hasSeriesData ? (
        <EmptyState
          icon={BarChart3}
          title={t("dashboardV2.analytics.empty.title")}
          description={t("dashboardV2.analytics.empty.desc")}
          cta={t("dashboardV2.analytics.empty.cta")}
          onCta={() => navigate("/dashboard/documents")}
          testId="dashboard-analytics-empty"
        />
      ) : (
        <Suspense fallback={<ChartsSkeleton />}>
          <DashboardAnalyticsCharts
            series={series}
            period={period}
            labels={labels}
            formatCurrency={formatCurrency}
            compact
          />
        </Suspense>
      )}
    </section>
  );
}

export default memo(DashboardAnalyticsSection);
