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

const TOOLTIP_STYLE = {
  background: "#ffffff",
  border: "1px solid #E5E7EB",
  borderRadius: 10,
  boxShadow: "0 8px 24px -12px rgba(10,37,64,0.18)",
  fontSize: 12,
};

const AXIS_TICK = { fill: "#9CA3AF", fontSize: 11 };

function ChartShell({ title, children, testId }) {
  return (
    <div
      className="rounded-xl border border-[#E5E7EB] bg-white p-4 md:p-5 shadow-[0_1px_2px_rgba(10,37,64,0.04)]"
      data-testid={testId}
    >
      <h3 className="text-sm font-semibold text-[#111827] mb-3">{title}</h3>
      <div className="h-48 md:h-56 w-full min-w-0">{children}</div>
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
  const interval = useMemo(() => tickInterval(series?.length || 0), [series]);
  const revenueData = series || [];
  const docsData = series || [];
  const clientsData = series || [];

  return (
    <div
      className={compact ? "grid grid-cols-1 gap-3" : "grid grid-cols-1 lg:grid-cols-3 gap-3 md:gap-4"}
      data-testid="dashboard-analytics-charts"
    >
      <ChartShell title={labels.revenue} testId="dashboard-chart-revenue">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={revenueData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="dashRevenueFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#0A2540" stopOpacity={0.18} />
                <stop offset="100%" stopColor="#0A2540" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="#F3F4F6" vertical={false} />
            <XAxis dataKey="label" tick={AXIS_TICK} axisLine={false} tickLine={false} interval={interval} />
            <YAxis
              tick={AXIS_TICK}
              axisLine={false}
              tickLine={false}
              width={44}
              tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v))}
            />
            <Tooltip
              contentStyle={TOOLTIP_STYLE}
              formatter={(value) => [formatCurrency(Math.round(value * 100)), labels.revenueSeries]}
              labelStyle={{ color: "#6B7280" }}
            />
            <Area
              type="monotone"
              dataKey="revenueEuros"
              stroke="#0A2540"
              strokeWidth={2}
              fill="url(#dashRevenueFill)"
              name={labels.revenueSeries}
              isAnimationActive={period !== "30d"}
            />
          </AreaChart>
        </ResponsiveContainer>
      </ChartShell>

      {!compact ? (
        <>
          <ChartShell title={labels.documents} testId="dashboard-chart-documents">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={docsData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="#F3F4F6" vertical={false} />
                <XAxis dataKey="label" tick={AXIS_TICK} axisLine={false} tickLine={false} interval={interval} />
                <YAxis allowDecimals={false} tick={AXIS_TICK} axisLine={false} tickLine={false} width={28} />
                <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={{ color: "#6B7280" }} />
                <Legend wrapperStyle={{ fontSize: 11, color: "#6B7280" }} />
                <Bar dataKey="quotes" name={labels.quotes} fill="#0A2540" radius={[4, 4, 0, 0]} maxBarSize={18} />
                <Bar dataKey="invoices" name={labels.invoices} fill="#60A5FA" radius={[4, 4, 0, 0]} maxBarSize={18} />
              </BarChart>
            </ResponsiveContainer>
          </ChartShell>

          <ChartShell title={labels.clients} testId="dashboard-chart-clients">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={clientsData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="#F3F4F6" vertical={false} />
                <XAxis dataKey="label" tick={AXIS_TICK} axisLine={false} tickLine={false} interval={interval} />
                <YAxis allowDecimals={false} tick={AXIS_TICK} axisLine={false} tickLine={false} width={28} />
                <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={{ color: "#6B7280" }} />
                <Line
                  type="monotone"
                  dataKey="clients"
                  name={labels.clientsSeries}
                  stroke="#0066FF"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
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
