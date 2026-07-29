import { formatInvoiceAmount } from "@/utils/invoiceDisplay";
import { formatTrendPercent } from "@/utils/dashboardAnalytics";

/**
 * Map GET /api/analytics/overview into shapes expected by DashboardHome widgets.
 */
export function mapAnalyticsToDashboardHome(data, { lang = "fr", clientsTotal = 0 } = {}) {
  if (!data) {
    return {
      kpis: null,
      pipeline: { quotes: {}, invoices: {} },
      series: [],
      topClients: [],
    };
  }

  const collected = data.kpis?.collectedRevenue;
  const quotePipeline = data.quotePipeline || {};
  const invoicePipeline = data.invoicePipeline || {};
  const newClients = data.kpis?.newClients?.value ?? data.clientStats?.newClients ?? 0;

  const changePercent = collected?.changePercent;
  const trendPercent =
    changePercent == null || (collected?.previous === 0 && (collected?.value || 0) > 0)
      ? null
      : Math.round(changePercent);

  const kpis = {
    revenue: {
      value: collected?.value ?? 0,
      formatted: formatInvoiceAmount(collected?.value ?? 0, lang),
      trendPercent,
      trendFormatted: formatTrendPercent(trendPercent),
      helperCount: data.kpis?.paidInvoices?.value ?? invoicePipeline.paid ?? 0,
    },
    clients: {
      total: clientsTotal,
      newThisMonth: Math.round(newClients),
    },
    quotes: {
      pending: quotePipeline.sent ?? 0,
      accepted: quotePipeline.accepted ?? 0,
      total: quotePipeline.total ?? 0,
    },
    invoices: {
      paid: invoicePipeline.paid ?? 0,
      pending: (invoicePipeline.pending ?? 0) + (invoicePipeline.overdue ?? 0),
      total: invoicePipeline.created ?? 0,
    },
  };

  const pipeline = {
    quotes: {
      draft: quotePipeline.draft ?? 0,
      sent: quotePipeline.sent ?? 0,
      accepted: quotePipeline.accepted ?? 0,
      rejected: quotePipeline.rejected ?? 0,
    },
    invoices: {
      pending: invoicePipeline.pending ?? 0,
      paid: invoicePipeline.paid ?? 0,
      overdue: invoicePipeline.overdue ?? 0,
    },
  };

  const series = mergeAnalyticsSeries(data, lang);

  const topClients = (data.topClients || []).map((row) => ({
    clientId: row.clientId,
    clientName: row.clientName,
    total: row.collected ?? 0,
    collected: row.collected ?? 0,
    billed: row.billed ?? 0,
    quoteCount: row.quoteCount ?? 0,
    invoiceCount: row.invoiceCount ?? 0,
    lastContactAt: row.lastActivityAt || null,
  }));

  return { kpis, pipeline, series, topClients };
}

function mergeAnalyticsSeries(data, lang) {
  const financial = data.financialSeries || [];
  const commercial = data.commercialSeries || [];
  const clients = data.clientSeries || [];

  const byKey = new Map();

  for (const point of financial) {
    const collected = point.values?.collected ?? 0;
    byKey.set(point.key, {
      key: point.key,
      label: point.label,
      revenue: collected,
      revenueEuros: Math.round((collected / 100) * 100) / 100,
      formattedRevenue: formatInvoiceAmount(collected, lang),
      quotes: 0,
      invoices: 0,
      clients: 0,
    });
  }

  for (const point of commercial) {
    const existing = byKey.get(point.key) || {
      key: point.key,
      label: point.label,
      revenue: 0,
      revenueEuros: 0,
      formattedRevenue: formatInvoiceAmount(0, lang),
      quotes: 0,
      invoices: 0,
      clients: 0,
    };
    existing.quotes = point.values?.quotesCreated ?? 0;
    existing.invoices = point.values?.invoicesCreated ?? 0;
    if (!existing.label) existing.label = point.label;
    byKey.set(point.key, existing);
  }

  for (const point of clients) {
    const existing = byKey.get(point.key) || {
      key: point.key,
      label: point.label,
      revenue: 0,
      revenueEuros: 0,
      formattedRevenue: formatInvoiceAmount(0, lang),
      quotes: 0,
      invoices: 0,
      clients: 0,
    };
    existing.clients = point.values?.newClients ?? 0;
    if (!existing.label) existing.label = point.label;
    byKey.set(point.key, existing);
  }

  return Array.from(byKey.values());
}

export function formatKpiChangePercent(changePercent, previous) {
  if (changePercent == null) return null;
  if (previous === 0) return null;
  const rounded = Math.round(changePercent);
  const sign = rounded > 0 ? "+" : "";
  return `${sign}${rounded}%`;
}

export function formatKpiValue(kpi, lang = "fr") {
  if (!kpi) return "—";
  if (kpi.unit === "currency_cents") return formatInvoiceAmount(kpi.value ?? 0, lang);
  if (kpi.unit === "ratio") {
    const pct = Math.round((kpi.value ?? 0) * 1000) / 10;
    return `${pct} %`;
  }
  return String(Math.round(kpi.value ?? 0));
}
