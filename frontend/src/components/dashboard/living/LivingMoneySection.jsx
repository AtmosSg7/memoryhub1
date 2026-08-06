import { memo, Suspense, lazy } from "react";
import { formatInvoiceAmount } from "@/utils/invoiceDisplay";
import { Skeleton } from "@/components/ui/skeleton";
import { useDashboardLang } from "@/hooks/useDashboardLang";

const DashboardAnalyticsCharts = lazy(
  () => import("@/components/dashboard/DashboardAnalyticsCharts"),
);

function LivingMoneySection({ money, series, period, onPeriodChange, empty, loading, t }) {
  const { lang } = useDashboardLang();
  const periods = [
    { id: "7d", label: t("livingDashboard.period.7d") },
    { id: "30d", label: t("livingDashboard.period.30d") },
    { id: "3m", label: t("livingDashboard.period.3m") },
  ];

  return (
    <section className="space-y-3" data-testid="living-money">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-dash-text-subtle">
            {t("livingDashboard.money.title")}
          </h2>
          <p className="text-sm text-dash-text-muted mt-0.5">{t("livingDashboard.money.subtitle")}</p>
        </div>
        <div className="inline-flex rounded-lg border border-dash-border bg-dash-surface p-0.5">
          {periods.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => onPeriodChange?.(p.id)}
              className={[
                "px-2.5 py-1 text-xs rounded-md transition-colors",
                period === p.id
                  ? "bg-dash-primary text-white"
                  : "text-dash-text-muted hover:text-dash-text",
              ].join(" ")}
              data-testid={`living-money-period-${p.id}`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {[
          { key: "collected", value: money?.collected },
          { key: "pending", value: (money?.pending || 0) /* count — show as count */ , asCount: true },
          { key: "paid", value: money?.paid, asCount: true },
        ].map((row) => (
          <div
            key={row.key}
            className="rounded-xl border border-dash-border bg-dash-surface p-3"
            data-testid={`living-money-${row.key}`}
          >
            <p className="text-[11px] text-dash-text-subtle">{t(`livingDashboard.money.${row.key}`)}</p>
            <p className="text-lg font-semibold text-dash-text mt-1 tabular-nums">
              {row.asCount
                ? row.value ?? 0
                : formatInvoiceAmount(row.value ?? 0, lang)}
            </p>
          </div>
        ))}
      </div>

      {loading ? (
        <Skeleton className="h-56 w-full rounded-xl bg-dash-surface-muted" />
      ) : empty ? (
        <div className="rounded-xl border border-dashed border-dash-border bg-dash-surface-muted/50 p-8 text-center text-sm text-dash-text-muted">
          {t("livingDashboard.money.empty")}
        </div>
      ) : (
        <Suspense fallback={<Skeleton className="h-56 w-full rounded-xl bg-dash-surface-muted" />}>
          <DashboardAnalyticsCharts
            series={series}
            period={period}
            compact={false}
            formatCurrency={(cents) => formatInvoiceAmount(cents, lang)}
            labels={{
              revenue: t("livingDashboard.money.evolution"),
              revenueSeries: t("livingDashboard.money.collected"),
              documents: t("livingDashboard.money.documents"),
              clients: t("livingDashboard.kpis.newClients"),
            }}
          />
        </Suspense>
      )}
    </section>
  );
}

export default memo(LivingMoneySection);
