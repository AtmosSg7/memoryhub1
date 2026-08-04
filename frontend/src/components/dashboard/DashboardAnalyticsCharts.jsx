import { memo, useMemo } from "react";
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
import { useDashboardChartTheme } from "@/hooks/useDashboardChartTheme";

function ChartShell({ title, children, testId }) {
  return (
    <div
      className="rounded-xl border border-dash-border bg-dash-surface p-5 md:p-6 dash-panel"
      data-testid={testId}
    >
      <h3 className="dash-section mb-4">{title}</h3>
      <div className="h-52 md:h-60 w-full min-w-0">{children}</div>
    </div>
  );
}

function tickInterval(dataLength) {
  if (dataLength <= 8) return 0;
  if (dataLength <= 16) return 1;
  if (dataLength <= 31) return 4;
  return 1;
}

function DashboardAnalyticsCharts({ series, period, labels, formatCurrency, compact = true }) {
  const chartTheme = useDashboardChartTheme();
  const interval = useMemo(() => tickInterval(series?.length || 0), [series]);
  const revenueData = series || [];
  const docsData = series || [];
  const clientsData = series || [];

  return (
    <div
      className={compact ? "grid grid-cols-1 gap-4" : "grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-5"}
      data-testid="dashboard-analytics-charts"
    >
      <ChartShell title={labels.revenue} testId="dashboard-chart-revenue">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={revenueData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="dashRevenueFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={chartTheme.primary} stopOpacity={chartTheme.areaOpacity} />
                <stop offset="100%" stopColor={chartTheme.primary} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke={chartTheme.grid} vertical={false} strokeDasharray={chartTheme.gridDash} />
            <XAxis dataKey="label" tick={chartTheme.axisTick} axisLine={false} tickLine={false} interval={interval} />
            <YAxis
              tick={chartTheme.axisTick}
              axisLine={false}
              tickLine={false}
              width={44}
              tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v))}
            />
            <Tooltip
              contentStyle={chartTheme.tooltip}
              formatter={(value) => [formatCurrency(Math.round(value * 100)), labels.revenueSeries]}
              labelStyle={chartTheme.tooltipLabel}
            />
            <Area
              type="monotone"
              dataKey="revenueEuros"
              stroke={chartTheme.primary}
              strokeWidth={chartTheme.strokeWidth}
              strokeLinecap="round"
              fill="url(#dashRevenueFill)"
              name={labels.revenueSeries}
              isAnimationActive={period !== "30d"}
              activeDot={{ ...chartTheme.activeDot, fill: chartTheme.primary }}
              style={chartTheme.lineGlow !== "none" ? { filter: chartTheme.lineGlow } : undefined}
            />
          </AreaChart>
        </ResponsiveContainer>
      </ChartShell>

      {!compact ? (
        <>
          <ChartShell title={labels.documents} testId="dashboard-chart-documents">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={docsData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid stroke={chartTheme.grid} vertical={false} strokeDasharray={chartTheme.gridDash} />
                <XAxis dataKey="label" tick={chartTheme.axisTick} axisLine={false} tickLine={false} interval={interval} />
                <YAxis allowDecimals={false} tick={chartTheme.axisTick} axisLine={false} tickLine={false} width={28} />
                <Tooltip contentStyle={chartTheme.tooltip} labelStyle={chartTheme.tooltipLabel} />
                <Legend wrapperStyle={{ fontSize: 11, color: chartTheme.axis }} />
                <Bar dataKey="quotes" name={labels.quotes} fill={chartTheme.primary} radius={[4, 4, 0, 0]} maxBarSize={18} />
                <Bar dataKey="invoices" name={labels.invoices} fill={chartTheme.cyan} radius={[4, 4, 0, 0]} maxBarSize={18} />
              </BarChart>
            </ResponsiveContainer>
          </ChartShell>

          <ChartShell title={labels.clients} testId="dashboard-chart-clients">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={clientsData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid stroke={chartTheme.grid} vertical={false} strokeDasharray={chartTheme.gridDash} />
                <XAxis dataKey="label" tick={chartTheme.axisTick} axisLine={false} tickLine={false} interval={interval} />
                <YAxis allowDecimals={false} tick={chartTheme.axisTick} axisLine={false} tickLine={false} width={28} />
                <Tooltip contentStyle={chartTheme.tooltip} labelStyle={chartTheme.tooltipLabel} />
                <Line
                  type="monotone"
                  dataKey="clients"
                  name={labels.clientsSeries}
                  stroke={chartTheme.violet}
                  strokeWidth={chartTheme.strokeWidth}
                  strokeLinecap="round"
                  dot={false}
                  activeDot={{ ...chartTheme.activeDot, fill: chartTheme.violet }}
                  style={chartTheme.lineGlow !== "none" ? { filter: chartTheme.lineGlow } : undefined}
                />
              </LineChart>
            </ResponsiveContainer>
          </ChartShell>
        </>
      ) : null}
    </div>
  );
}

export default memo(DashboardAnalyticsCharts);
