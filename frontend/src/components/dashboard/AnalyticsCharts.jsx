import { memo, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useDashboardLang } from "@/hooks/useDashboardLang";
import { useDashboardChartTheme } from "@/hooks/useDashboardChartTheme";
import { formatInvoiceAmount } from "@/utils/invoiceDisplay";

const FINANCIAL_METRIC_KEYS = [
  { key: "collected", colorKey: "primary" },
  { key: "billed", colorKey: "violet" },
  { key: "outstanding", colorKey: "orange" },
];

function ChartShell({ title, actions, children, testId }) {
  return (
    <div
      className="rounded-xl border border-dash-border bg-dash-surface p-5 md:p-6 dash-panel"
      data-testid={testId}
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
        <h3 className="dash-section">{title}</h3>
        {actions}
      </div>
      <div className="h-56 md:h-64 w-full min-w-0">{children}</div>
    </div>
  );
}

function tickInterval(length) {
  if (length <= 8) return 0;
  if (length <= 16) return 1;
  if (length <= 31) return 4;
  return 1;
}

function MetricToggle({ options, value, onChange, testId }) {
  return (
    <div className="inline-flex flex-wrap gap-1 rounded-lg border border-dash-border-soft bg-dash-surface-muted p-0.5" data-testid={testId}>
      {options.map((option) => {
        const active = value === option.key;
        return (
          <button
            key={option.key}
            type="button"
            onClick={() => onChange(option.key)}
            className={[
              "px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors",
              active
                ? "bg-[var(--dash-nav-active-bg)] text-[var(--dash-nav-active-text)]"
                : "text-dash-text-muted hover:text-dash-text",
            ].join(" ")}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

function AnalyticsCharts({ financialSeries, commercialSeries, clientSeries, revenueBreakdown }) {
  const { t, lang } = useDashboardLang();
  const chartTheme = useDashboardChartTheme();
  const [financialMetric, setFinancialMetric] = useState("collected");

  const financialMetrics = FINANCIAL_METRIC_KEYS.map((metric) => ({
    key: metric.key,
    color: chartTheme[metric.colorKey],
  }));

  const formatCurrency = useMemo(() => (cents) => formatInvoiceAmount(cents, lang), [lang]);

  const financialData = useMemo(
    () =>
      (financialSeries || []).map((point) => ({
        key: point.key,
        label: point.label,
        collected: point.values?.collected ?? 0,
        billed: point.values?.billed ?? 0,
        outstanding: point.values?.outstanding ?? 0,
      })),
    [financialSeries]
  );

  const commercialData = useMemo(
    () =>
      (commercialSeries || []).map((point) => ({
        key: point.key,
        label: point.label,
        quotesCreated: point.values?.quotesCreated ?? 0,
        quotesAccepted: point.values?.quotesAccepted ?? 0,
        invoicesCreated: point.values?.invoicesCreated ?? 0,
        invoicesPaid: point.values?.invoicesPaid ?? 0,
      })),
    [commercialSeries]
  );

  const clientData = useMemo(
    () =>
      (clientSeries || []).map((point) => ({
        key: point.key,
        label: point.label,
        newClients: point.values?.newClients ?? 0,
        activeClients: point.values?.activeClients ?? 0,
      })),
    [clientSeries]
  );

  const breakdown = revenueBreakdown || [];
  const maxBreakdown = Math.max(...breakdown.map((item) => item.amount || 0), 1);
  const financialMeta = financialMetrics.find((m) => m.key === financialMetric) || financialMetrics[0];
  const interval = tickInterval(financialData.length);

  const financialOptions = financialMetrics.map((m) => ({
    key: m.key,
    label: t(`analyticsPage.charts.financialMetrics.${m.key}`),
  }));

  return (
    <div className="space-y-4 md:space-y-5" data-testid="analytics-charts">
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 md:gap-5">
        <ChartShell
          title={t("analyticsPage.charts.financialTitle")}
          testId="analytics-chart-financial"
          actions={
            <MetricToggle
              options={financialOptions}
              value={financialMetric}
              onChange={setFinancialMetric}
              testId="analytics-financial-toggle"
            />
          }
        >
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={financialData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="analyticsFinancialFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={financialMeta.color} stopOpacity={chartTheme.areaOpacity} />
                  <stop offset="100%" stopColor={financialMeta.color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke={chartTheme.grid} vertical={false} strokeDasharray={chartTheme.gridDash} />
              <XAxis dataKey="label" tick={chartTheme.axisTick} axisLine={false} tickLine={false} interval={interval} />
              <YAxis
                tick={chartTheme.axisTick}
                axisLine={false}
                tickLine={false}
                width={48}
                tickFormatter={(v) => (v >= 100000 ? `${Math.round(v / 100000)}k` : String(Math.round(v / 100)))}
              />
              <Tooltip
                contentStyle={chartTheme.tooltip}
                formatter={(value) => [formatCurrency(Math.round(value)), financialOptions.find((o) => o.key === financialMetric)?.label]}
                labelStyle={chartTheme.tooltipLabel}
                cursor={{ stroke: chartTheme.grid, strokeWidth: 1 }}
              />
              <Area
                type="monotone"
                dataKey={financialMetric}
                stroke={financialMeta.color}
                strokeWidth={chartTheme.strokeWidth}
                strokeLinecap="round"
                fill="url(#analyticsFinancialFill)"
                activeDot={{ ...chartTheme.activeDot, fill: financialMeta.color }}
                isAnimationActive
                style={chartTheme.lineGlow !== "none" ? { filter: chartTheme.lineGlow } : undefined}
              />
            </AreaChart>
          </ResponsiveContainer>
        </ChartShell>

        <ChartShell title={t("analyticsPage.charts.commercialTitle")} testId="analytics-chart-commercial">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={commercialData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid stroke={chartTheme.grid} vertical={false} strokeDasharray={chartTheme.gridDash} />
              <XAxis dataKey="label" tick={chartTheme.axisTick} axisLine={false} tickLine={false} interval={interval} />
              <YAxis allowDecimals={false} tick={chartTheme.axisTick} axisLine={false} tickLine={false} width={28} />
              <Tooltip contentStyle={chartTheme.tooltip} labelStyle={chartTheme.tooltipLabel} />
              <Legend wrapperStyle={{ fontSize: 11, color: chartTheme.axis }} />
              <Bar dataKey="quotesCreated" name={t("analyticsPage.charts.series.quotesCreated")} fill={chartTheme.primary} radius={[4, 4, 0, 0]} maxBarSize={16} />
              <Bar dataKey="quotesAccepted" name={t("analyticsPage.charts.series.quotesAccepted")} fill={chartTheme.green} radius={[4, 4, 0, 0]} maxBarSize={16} />
              <Bar dataKey="invoicesCreated" name={t("analyticsPage.charts.series.invoicesCreated")} fill={chartTheme.cyan} radius={[4, 4, 0, 0]} maxBarSize={16} />
              <Bar dataKey="invoicesPaid" name={t("analyticsPage.charts.series.invoicesPaid")} fill={chartTheme.violet} radius={[4, 4, 0, 0]} maxBarSize={16} />
            </BarChart>
          </ResponsiveContainer>
        </ChartShell>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 md:gap-5">
        <ChartShell title={t("analyticsPage.charts.clientsTitle")} testId="analytics-chart-clients">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={clientData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid stroke={chartTheme.grid} vertical={false} strokeDasharray={chartTheme.gridDash} />
              <XAxis dataKey="label" tick={chartTheme.axisTick} axisLine={false} tickLine={false} interval={interval} />
              <YAxis allowDecimals={false} tick={chartTheme.axisTick} axisLine={false} tickLine={false} width={28} />
              <Tooltip contentStyle={chartTheme.tooltip} labelStyle={chartTheme.tooltipLabel} />
              <Legend wrapperStyle={{ fontSize: 11, color: chartTheme.axis }} />
              <Line
                type="monotone"
                dataKey="newClients"
                name={t("analyticsPage.charts.series.newClients")}
                stroke={chartTheme.primary}
                strokeWidth={chartTheme.strokeWidth}
                strokeLinecap="round"
                dot={false}
                activeDot={{ ...chartTheme.activeDot, fill: chartTheme.primary }}
                style={chartTheme.lineGlow !== "none" ? { filter: chartTheme.lineGlow } : undefined}
              />
              <Line
                type="monotone"
                dataKey="activeClients"
                name={t("analyticsPage.charts.series.activeClients")}
                stroke={chartTheme.cyan}
                strokeWidth={chartTheme.strokeWidth}
                strokeLinecap="round"
                dot={false}
                activeDot={{ ...chartTheme.activeDot, fill: chartTheme.cyan }}
                style={chartTheme.lineGlow !== "none" ? { filter: chartTheme.lineGlow } : undefined}
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartShell>

        <div
          className="rounded-xl border border-dash-border bg-dash-surface p-5 md:p-6 dash-panel"
          data-testid="analytics-chart-breakdown"
        >
          <h3 className="dash-section mb-5">{t("analyticsPage.charts.breakdownTitle")}</h3>
          {!breakdown.length ? (
            <p className="text-sm text-dash-text-muted py-8 text-center">{t("analyticsPage.charts.breakdownEmpty")}</p>
          ) : (
            <div className="space-y-3.5">
              {breakdown.map((item) => {
                const width = Math.max(item.amount > 0 ? 6 : 0, Math.round(((item.amount || 0) / maxBreakdown) * 100));
                return (
                  <div key={item.key} className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="text-dash-text-muted truncate">{item.label}</span>
                      <span className="tabular-nums font-semibold text-dash-text shrink-0">
                        {formatCurrency(item.amount)}
                        <span className="text-dash-text-subtle font-medium ml-1.5">
                          {Math.round(item.sharePercent || 0)}%
                        </span>
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-dash-surface-muted overflow-hidden">
                      <div className="h-full rounded-full bg-[color:var(--dash-chart-primary)]" style={{ width: `${width}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default memo(AnalyticsCharts);
