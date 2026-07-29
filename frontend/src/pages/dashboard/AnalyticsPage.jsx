import { lazy, Suspense, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BarChart3 } from "lucide-react";
import { useDashboardLang } from "@/hooks/useDashboardLang";
import { usePageTitle } from "@/hooks/usePageTitle";
import { useAnalyticsPeriod } from "@/hooks/useAnalyticsPeriod";
import { useAnalyticsOverview } from "@/hooks/useAnalyticsOverview";
import { ANALYTICS_PERIOD_KEYS } from "@/utils/analyticsPeriod";
import { formatKpiChangePercent, formatKpiValue } from "@/utils/mapAnalyticsOverview";
import { commercialDocumentsPath } from "@/utils/commercialDocumentsPath";
import { formatInvoiceAmount } from "@/utils/invoiceDisplay";
import { formatLastInteraction, getClientColor, getClientInitials } from "@/utils/clientDisplay";
import PageHeader from "@/components/dashboard/PageHeader";
import EmptyState from "@/components/dashboard/EmptyState";
import KpiInfoHint from "@/components/dashboard/KpiInfoHint";
import DemoDataBadge from "@/components/dashboard/DemoDataBadge";
import { MetricCardsSkeleton, PageError } from "@/components/dashboard/PageFeedback";
import { Skeleton } from "@/components/ui/skeleton";

const AnalyticsCharts = lazy(() => import("@/components/dashboard/AnalyticsCharts"));

const KPI_KEYS = [
  "collectedRevenue",
  "billedRevenue",
  "outstandingAmount",
  "newClients",
  "quotesCreated",
  "quoteAcceptanceRate",
  "paidInvoices",
  "averageBasket",
];

const QUOTE_STATUS_KEYS = ["draft", "sent", "accepted", "rejected", "expired"];
const INVOICE_STATUS_KEYS = [
  { id: "pending", status: "in_progress" },
  { id: "paid", status: "paid" },
  { id: "overdue", status: "overdue" },
];

const SORT_KEYS = ["collected", "billed", "invoices", "activity"];

function ChartsSkeleton() {
  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-3" data-testid="analytics-charts-skeleton">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="rounded-xl border border-[#E5E7EB] bg-white p-4 space-y-3">
          <Skeleton className="h-4 w-40 bg-[#E5E7EB]" />
          <Skeleton className="h-52 w-full bg-[#F3F4F6]" />
        </div>
      ))}
    </div>
  );
}

function SectionCard({ title, subtitle, children, testId }) {
  return (
    <section
      className="rounded-xl border border-[#E5E7EB] bg-white p-4 md:p-5 shadow-[0_1px_2px_rgba(10,37,64,0.04)]"
      data-testid={testId}
    >
      <div className="mb-4">
        <h2 className="font-cabinet text-base md:text-lg font-bold text-[#111827] tracking-tight">{title}</h2>
        {subtitle ? <p className="text-xs text-[#6B7280] mt-0.5">{subtitle}</p> : null}
      </div>
      {children}
    </section>
  );
}

function PipelineButton({ label, count, amount, onClick, testId }) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid={testId}
      className="w-full text-left rounded-lg border border-[#E5E7EB] px-3 py-2.5 hover:border-[#0A2540]/30 hover:bg-[#FAFBFC] transition-colors"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-[#4B5563]">{label}</span>
        <span className="text-sm font-semibold tabular-nums text-[#111827]">{count}</span>
      </div>
      {amount != null ? (
        <p className="mt-1 text-[11px] tabular-nums text-[#6B7280]">{amount}</p>
      ) : null}
    </button>
  );
}

export default function AnalyticsPage() {
  const { t, lang } = useDashboardLang();
  usePageTitle("page.analytics.title");
  const navigate = useNavigate();
  const { period, from, to, timezone, setPeriod, setCustomRange } = useAnalyticsPeriod();
  const [sort, setSort] = useState("collected");

  const { data, loading, error, refetch } = useAnalyticsOverview({
    period,
    from,
    to,
    timezone,
    sort,
  });

  const kpis = data?.kpis;
  const quotePipeline = data?.quotePipeline || {};
  const invoicePipeline = data?.invoicePipeline || {};
  const topClients = data?.topClients || [];
  const periodArgs = useMemo(
    () =>
      data?.period?.fromDate && data?.period?.toDate
        ? { from: data.period.fromDate, to: data.period.toDate }
        : {},
    [data?.period]
  );

  const comparisonItems = useMemo(() => {
    const comparison = data?.comparison || {};
    return [
      { key: "collectedRevenue", value: comparison.collectedRevenue },
      { key: "billedRevenue", value: comparison.billedRevenue },
      { key: "newClients", value: comparison.newClients },
      { key: "acceptedQuotes", value: comparison.acceptedQuotes },
      { key: "paidInvoices", value: comparison.paidInvoices },
    ].filter((item) => item.value != null);
  }, [data?.comparison]);

  return (
    <div className="space-y-6 md:space-y-8" data-testid="analytics-page">
      <div className="flex flex-wrap items-start gap-2">
        <div className="flex-1 min-w-0">
          <PageHeader
            title={t("page.analytics.title")}
            subtitle={t("page.analytics.subtitle")}
            testId="analytics-header"
          />
        </div>
        <DemoDataBadge />
      </div>

      <div className="flex flex-col gap-3">
        <div
          className="inline-flex flex-wrap items-center gap-1 rounded-xl border border-[#E5E7EB] bg-white p-1 w-fit"
          role="tablist"
          aria-label={t("analyticsPage.periodLabel")}
        >
          {ANALYTICS_PERIOD_KEYS.map((key) => {
            const active = period === key;
            return (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setPeriod(key)}
                className={[
                  "px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors",
                  active
                    ? "bg-[#0A2540] text-white"
                    : "text-[#6B7280] hover:text-[#111827] hover:bg-[#F9FAFB]",
                ].join(" ")}
                data-testid={`analytics-period-${key}`}
              >
                {t(`analyticsPage.periods.${key}`)}
              </button>
            );
          })}
        </div>

        {period === "custom" ? (
          <div className="flex flex-wrap items-end gap-3" data-testid="analytics-custom-range">
            <label className="text-xs text-[#6B7280]">
              <span className="block mb-1 font-medium">{t("analyticsPage.from")}</span>
              <input
                type="date"
                value={from}
                onChange={(e) => setCustomRange(e.target.value, to)}
                className="rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm text-[#111827]"
              />
            </label>
            <label className="text-xs text-[#6B7280]">
              <span className="block mb-1 font-medium">{t("analyticsPage.to")}</span>
              <input
                type="date"
                value={to}
                onChange={(e) => setCustomRange(from, e.target.value)}
                className="rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm text-[#111827]"
              />
            </label>
          </div>
        ) : null}
      </div>

      {loading ? (
        <div className="space-y-6" data-testid="analytics-loading">
          <MetricCardsSkeleton count={8} testId="analytics-kpi-skeleton" />
          <ChartsSkeleton />
        </div>
      ) : error ? (
        <div className="space-y-3">
          <PageError message={error} testId="analytics-error" />
          <button
            type="button"
            onClick={() => refetch()}
            className="text-sm font-semibold text-[#0A2540] hover:underline"
          >
            {t("analyticsPage.retry")}
          </button>
        </div>
      ) : data?.empty ? (
        <EmptyState
          icon={BarChart3}
          title={t("analyticsPage.empty.title")}
          description={t("analyticsPage.empty.desc")}
          cta={t("analyticsPage.empty.cta")}
          onCta={() => navigate("/dashboard/documents")}
          secondaryCta={t("analyticsPage.empty.secondaryCta")}
          onSecondaryCta={() => navigate("/dashboard/clients")}
          testId="analytics-empty"
        />
      ) : (
        <>
          <section
            className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4"
            data-testid="analytics-kpi-grid"
            aria-label={t("analyticsPage.kpi.sectionLabel")}
          >
            {KPI_KEYS.map((key) => {
              const kpi = kpis?.[key];
              const change = formatKpiChangePercent(kpi?.changePercent, kpi?.previous);
              const tone =
                change == null ? "neutral" : kpi.changePercent >= 0 ? "positive" : "negative";
              const noDecision =
                key === "quoteAcceptanceRate" && quotePipeline.acceptanceRate == null;
              return (
                <div
                  key={key}
                  className="rounded-xl border border-[#E5E7EB] bg-white p-4 md:p-5 shadow-[0_1px_2px_rgba(10,37,64,0.04)] min-h-[108px]"
                  data-testid={`analytics-kpi-${key}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#9CA3AF] truncate">
                      {t(`analyticsPage.kpi.${key}`)}
                    </p>
                    <KpiInfoHint
                      label={t(`analyticsPage.kpi.${key}`)}
                      text={t(`analyticsPage.kpi.hints.${key}`)}
                      testId={`analytics-kpi-${key}-info`}
                    />
                  </div>
                  <p className="mt-2.5 font-cabinet text-xl md:text-2xl font-bold tracking-tight text-[#111827] tabular-nums leading-none">
                    {noDecision ? "—" : formatKpiValue(kpi, lang)}
                  </p>
                  <div className="mt-3 min-h-[22px]">
                    {noDecision ? (
                      <span className="text-xs text-[#9CA3AF]">{t("analyticsPage.kpi.noDecision")}</span>
                    ) : change ? (
                      <span
                        className={[
                          "inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] font-semibold tabular-nums",
                          tone === "positive"
                            ? "text-[#065F46] bg-[#ECFDF5]"
                            : tone === "negative"
                              ? "text-[#991B1B] bg-[#FEF2F2]"
                              : "text-[#4B5563] bg-[#F3F4F6]",
                        ].join(" ")}
                      >
                        {change}
                        <span className="ml-1 font-medium text-[#6B7280]">{t("analyticsPage.kpi.vsPrevious")}</span>
                      </span>
                    ) : (
                      <span className="text-xs text-[#9CA3AF]">{t("analyticsPage.kpi.noComparison")}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </section>

          <Suspense fallback={<ChartsSkeleton />}>
            <AnalyticsCharts
              financialSeries={data.financialSeries}
              commercialSeries={data.commercialSeries}
              clientSeries={data.clientSeries}
              revenueBreakdown={data.revenueBreakdown}
            />
          </Suspense>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 md:gap-4">
            <SectionCard
              title={t("analyticsPage.quotes.title")}
              subtitle={t("analyticsPage.quotes.subtitle")}
              testId="analytics-quote-pipeline"
            >
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-4">
                {QUOTE_STATUS_KEYS.map((status) => (
                  <PipelineButton
                    key={status}
                    label={t(`quoteStatus.${status}`)}
                    count={quotePipeline[status] ?? 0}
                    onClick={() =>
                      navigate(commercialDocumentsPath({ kind: "quote", status, ...periodArgs }))
                    }
                    testId={`analytics-quote-${status}`}
                  />
                ))}
              </div>
              <div className="grid grid-cols-2 gap-3 text-xs text-[#6B7280] border-t border-[#F3F4F6] pt-3">
                <div>
                  <p>{t("analyticsPage.quotes.proposed")}</p>
                  <p className="mt-0.5 text-sm font-semibold text-[#111827] tabular-nums">
                    {formatInvoiceAmount(quotePipeline.proposedAmount ?? 0, lang)}
                  </p>
                </div>
                <div>
                  <p>{t("analyticsPage.quotes.acceptedAmount")}</p>
                  <p className="mt-0.5 text-sm font-semibold text-[#111827] tabular-nums">
                    {formatInvoiceAmount(quotePipeline.acceptedAmount ?? 0, lang)}
                  </p>
                </div>
                <div>
                  <p>{t("analyticsPage.quotes.acceptanceRate")}</p>
                  <p className="mt-0.5 text-sm font-semibold text-[#111827] tabular-nums">
                    {quotePipeline.acceptanceRate == null
                      ? "—"
                      : `${Math.round(quotePipeline.acceptanceRate * 1000) / 10} %`}
                  </p>
                </div>
                <div>
                  <p>{t("analyticsPage.quotes.avgDays")}</p>
                  <p className="mt-0.5 text-sm font-semibold text-[#111827] tabular-nums">
                    {quotePipeline.avgAcceptanceDays == null
                      ? "—"
                      : t("analyticsPage.quotes.days").replace(
                          "{count}",
                          String(Math.round(quotePipeline.avgAcceptanceDays))
                        )}
                  </p>
                </div>
              </div>
            </SectionCard>

            <SectionCard
              title={t("analyticsPage.invoices.title")}
              subtitle={t("analyticsPage.invoices.subtitle")}
              testId="analytics-invoice-pipeline"
            >
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-4">
                {INVOICE_STATUS_KEYS.map(({ id, status }) => (
                  <PipelineButton
                    key={id}
                    label={t(`analyticsPage.invoices.statuses.${id}`)}
                    count={invoicePipeline[id] ?? 0}
                    onClick={() =>
                      navigate(commercialDocumentsPath({ kind: "invoice", status, ...periodArgs }))
                    }
                    testId={`analytics-invoice-${id}`}
                  />
                ))}
              </div>
              <div className="grid grid-cols-2 gap-3 text-xs text-[#6B7280] border-t border-[#F3F4F6] pt-3">
                <div>
                  <p>{t("analyticsPage.invoices.billed")}</p>
                  <p className="mt-0.5 text-sm font-semibold text-[#111827] tabular-nums">
                    {formatInvoiceAmount(invoicePipeline.billedAmount ?? 0, lang)}
                  </p>
                </div>
                <div>
                  <p>{t("analyticsPage.invoices.collected")}</p>
                  <p className="mt-0.5 text-sm font-semibold text-[#111827] tabular-nums">
                    {formatInvoiceAmount(invoicePipeline.collectedAmount ?? 0, lang)}
                  </p>
                </div>
                <div>
                  <p>{t("analyticsPage.invoices.outstanding")}</p>
                  <p className="mt-0.5 text-sm font-semibold text-[#111827] tabular-nums">
                    {formatInvoiceAmount(invoicePipeline.outstandingAmount ?? 0, lang)}
                  </p>
                </div>
                <div>
                  <p>{t("analyticsPage.invoices.avgDays")}</p>
                  <p className="mt-0.5 text-sm font-semibold text-[#111827] tabular-nums">
                    {invoicePipeline.avgPaymentDays == null
                      ? "—"
                      : t("analyticsPage.invoices.days").replace(
                          "{count}",
                          String(Math.round(invoicePipeline.avgPaymentDays))
                        )}
                  </p>
                </div>
              </div>
            </SectionCard>
          </div>

          <SectionCard
            title={t("analyticsPage.topClients.title")}
            subtitle={t("analyticsPage.topClients.subtitle")}
            testId="analytics-top-clients"
          >
            <div className="flex flex-wrap gap-1 mb-4">
              {SORT_KEYS.map((key) => {
                const active = sort === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setSort(key)}
                    className={[
                      "px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors border",
                      active
                        ? "bg-[#0A2540] text-white border-[#0A2540]"
                        : "bg-white text-[#6B7280] border-[#E5E7EB] hover:text-[#111827]",
                    ].join(" ")}
                    data-testid={`analytics-sort-${key}`}
                  >
                    {t(`analyticsPage.topClients.sort.${key}`)}
                  </button>
                );
              })}
            </div>

            {!topClients.length ? (
              <p className="text-sm text-[#6B7280] py-4">{t("analyticsPage.topClients.empty")}</p>
            ) : (
              <div className="overflow-x-auto -mx-1">
                <table className="w-full min-w-[640px] text-left">
                  <thead>
                    <tr className="border-b border-[#F3F4F6]">
                      <th className="pb-2 pl-1 pr-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#9CA3AF]">
                        {t("analyticsPage.topClients.col.name")}
                      </th>
                      <th className="pb-2 px-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#9CA3AF] text-right">
                        {t("analyticsPage.topClients.col.collected")}
                      </th>
                      <th className="pb-2 px-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#9CA3AF] text-right hidden sm:table-cell">
                        {t("analyticsPage.topClients.col.billed")}
                      </th>
                      <th className="pb-2 px-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#9CA3AF] text-right hidden sm:table-cell">
                        {t("analyticsPage.topClients.col.invoices")}
                      </th>
                      <th className="pb-2 pl-2 pr-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#9CA3AF] text-right">
                        {t("analyticsPage.topClients.col.activity")}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {topClients.map((client) => {
                      const initials = getClientInitials({ name: client.clientName });
                      const color = getClientColor(client.clientId);
                      return (
                        <tr
                          key={client.clientId}
                          className="border-b border-[#F9FAFB] last:border-0 hover:bg-[#FAFAFA]"
                        >
                          <td className="py-2.5 pl-1 pr-2">
                            <button
                              type="button"
                              onClick={() => navigate(`/dashboard/clients/${client.clientId}`)}
                              className="flex items-center gap-2.5 text-left min-w-0"
                            >
                              <div
                                className="w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-semibold text-white shrink-0"
                                style={{ backgroundColor: color }}
                              >
                                {initials}
                              </div>
                              <span className="text-[13px] font-medium text-[#111827] truncate">
                                {client.clientName}
                              </span>
                            </button>
                          </td>
                          <td className="py-2.5 px-2 text-right text-[13px] font-semibold text-[#0A2540] tabular-nums whitespace-nowrap">
                            {formatInvoiceAmount(client.collected, lang)}
                          </td>
                          <td className="py-2.5 px-2 text-right text-[13px] tabular-nums text-[#4B5563] hidden sm:table-cell whitespace-nowrap">
                            {formatInvoiceAmount(client.billed, lang)}
                          </td>
                          <td className="py-2.5 px-2 text-right text-[13px] tabular-nums text-[#4B5563] hidden sm:table-cell">
                            {client.invoiceCount || 0}
                          </td>
                          <td className="py-2.5 pl-2 pr-1 text-right text-[11px] text-[#6B7280] whitespace-nowrap">
                            {formatLastInteraction(client.lastActivityAt, lang)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>

          {comparisonItems.length > 0 ? (
            <section
              className="rounded-xl border border-[#E5E7EB] bg-[#FAFBFC] p-4 md:p-5"
              data-testid="analytics-comparison"
            >
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#9CA3AF] mb-3">
                {t("analyticsPage.comparison.title")}
              </p>
              <div className="flex flex-wrap gap-3 md:gap-5">
                {comparisonItems.map((item) => {
                  const rounded = Math.round(item.value);
                  const positive = rounded >= 0;
                  return (
                    <div key={item.key} className="min-w-[120px]">
                      <p className="text-xs text-[#6B7280]">{t(`analyticsPage.comparison.${item.key}`)}</p>
                      <p
                        className={[
                          "mt-1 text-sm font-semibold tabular-nums",
                          positive ? "text-[#065F46]" : "text-[#991B1B]",
                        ].join(" ")}
                      >
                        {positive ? "+" : ""}
                        {rounded}%
                      </p>
                    </div>
                  );
                })}
              </div>
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}
