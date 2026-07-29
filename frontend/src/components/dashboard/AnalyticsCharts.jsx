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
import { formatInvoiceAmount } from "@/utils/invoiceDisplay";

const TOOLTIP_STYLE = {
  background: "#ffffff",
  border: "1px solid #E5E7EB",
  borderRadius: 10,
  boxShadow: "0 8px 24px -12px rgba(10,37,64,0.18)",
  fontSize: 12,
};

const AXIS_TICK = { fill: "#9CA3AF", fontSize: 11 };

const FINANCIAL_METRICS = [
  { key: "collected", color: "#0A2540" },
  { key: "billed", color: "#3B82F6" },
  { key: "outstanding", color: "#D97706" },
];

function ChartShell({ title, actions, children, testId }) {
  return (
    <div
      className="rounded-xl border border-[#E5E7EB] bg-white p-4 md:p-5 shadow-[0_1px_2px_rgba(10,37,64,0.04)]"
      data-testid={testId}
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
        <h3 className="text-sm font-semibold text-[#111827]">{title}</h3>
        {actions}
      </div>
      <div className="h-52 md:h-60 w-full min-w-0">{children}</div>
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
    <div className="inline-flex flex-wrap gap-1 rounded-lg border border-[#E5E7EB] bg-[#FAFAFA] p-0.5" data-testid={testId}>
      {options.map((option) => {
        const active = value === option.key;
        return (
          <button
            key={option.key}
            type="button"
            onClick={() => onChange(option.key)}
            className={[
              "px-2 py-1 rounded-md text-[11px] font-semibold transition-colors",
              active ? "bg-[#0A2540] text-white" : "text-[#6B7280] hover:text-[#111827]",
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
  const [financialMetric, setFinancialMetric] = useState("collected");

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
  const financialMeta = FINANCIAL_METRICS.find((m) => m.key === financialMetric) || FINANCIAL_METRICS[0];
  const interval = tickInterval(financialData.length);

  const financialOptions = FINANCIAL_METRICS.map((m) => ({
    key: m.key,
    label: t(`analyticsPage.charts.financialMetrics.${m.key}`),
  }));

  return (
    <div className="space-y-3 md:space-y-4" data-testid="analytics-charts">
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-3 md:gap-4">
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
                  <stop offset="0%" stopColor={financialMeta.color} stopOpacity={0.18} />
                  <stop offset="100%" stopColor={financialMeta.color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#F3F4F6" vertical={false} />
              <XAxis dataKey="label" tick={AXIS_TICK} axisLine={false} tickLine={false} interval={interval} />
              <YAxis
                tick={AXIS_TICK}
                axisLine={false}
                tickLine={false}
                width={48}
                tickFormatter={(v) => (v >= 100000 ? `${Math.round(v / 100000)}k` : String(Math.round(v / 100)))}
              />
              <Tooltip
                contentStyle={TOOLTIP_STYLE}
                formatter={(value) => [formatCurrency(Math.round(value)), financialOptions.find((o) => o.key === financialMetric)?.label]}
                labelStyle={{ color: "#6B7280" }}
              />
              <Area
                type="monotone"
                dataKey={financialMetric}
                stroke={financialMeta.color}
                strokeWidth={2}
                fill="url(#analyticsFinancialFill)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </ChartShell>

        <ChartShell title={t("analyticsPage.charts.commercialTitle")} testId="analytics-chart-commercial">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={commercialData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="#F3F4F6" vertical={false} />
              <XAxis dataKey="label" tick={AXIS_TICK} axisLine={false} tickLine={false} interval={interval} />
              <YAxis allowDecimals={false} tick={AXIS_TICK} axisLine={false} tickLine={false} width={28} />
              <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={{ color: "#6B7280" }} />
              <Legend wrapperStyle={{ fontSize: 11, color: "#6B7280" }} />
              <Bar dataKey="quotesCreated" name={t("analyticsPage.charts.series.quotesCreated")} fill="#0A2540" radius={[3, 3, 0, 0]} maxBarSize={14} />
              <Bar dataKey="quotesAccepted" name={t("analyticsPage.charts.series.quotesAccepted")} fill="#059669" radius={[3, 3, 0, 0]} maxBarSize={14} />
              <Bar dataKey="invoicesCreated" name={t("analyticsPage.charts.series.invoicesCreated")} fill="#3B82F6" radius={[3, 3, 0, 0]} maxBarSize={14} />
              <Bar dataKey="invoicesPaid" name={t("analyticsPage.charts.series.invoicesPaid")} fill="#60A5FA" radius={[3, 3, 0, 0]} maxBarSize={14} />
            </BarChart>
          </ResponsiveContainer>
        </ChartShell>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-3 md:gap-4">
        <ChartShell title={t("analyticsPage.charts.clientsTitle")} testId="analytics-chart-clients">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={clientData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="#F3F4F6" vertical={false} />
              <XAxis dataKey="label" tick={AXIS_TICK} axisLine={false} tickLine={false} interval={interval} />
              <YAxis allowDecimals={false} tick={AXIS_TICK} axisLine={false} tickLine={false} width={28} />
              <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={{ color: "#6B7280" }} />
              <Legend wrapperStyle={{ fontSize: 11, color: "#6B7280" }} />
              <Line type="monotone" dataKey="newClients" name={t("analyticsPage.charts.series.newClients")} stroke="#0A2540" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="activeClients" name={t("analyticsPage.charts.series.activeClients")} stroke="#3B82F6" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </ChartShell>

        <div
          className="rounded-xl border border-[#E5E7EB] bg-white p-4 md:p-5 shadow-[0_1px_2px_rgba(10,37,64,0.04)]"
          data-testid="analytics-chart-breakdown"
        >
          <h3 className="text-sm font-semibold text-[#111827] mb-4">{t("analyticsPage.charts.breakdownTitle")}</h3>
          {!breakdown.length ? (
            <p className="text-sm text-[#6B7280] py-8 text-center">{t("analyticsPage.charts.breakdownEmpty")}</p>
          ) : (
            <div className="space-y-3">
              {breakdown.map((item) => {
                const width = Math.max(item.amount > 0 ? 6 : 0, Math.round(((item.amount || 0) / maxBreakdown) * 100));
                return (
                  <div key={item.key} className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="text-[#4B5563] truncate">{item.label}</span>
                      <span className="tabular-nums font-semibold text-[#111827] shrink-0">
                        {formatCurrency(item.amount)}
                        <span className="text-[#9CA3AF] font-medium ml-1.5">
                          {Math.round(item.sharePercent || 0)}%
                        </span>
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-[#F3F4F6] overflow-hidden">
                      <div className="h-full rounded-full bg-[#0A2540]" style={{ width: `${width}%` }} />
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
