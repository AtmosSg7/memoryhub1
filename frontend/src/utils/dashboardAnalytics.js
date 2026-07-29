import { getClientLastActivityAt } from "@/utils/clientList";
import {
  formatInvoiceAmount,
  getInvoiceAmountPaid,
  getInvoiceDate,
  normalizeInvoiceStatus,
} from "@/utils/invoiceDisplay";
import { getQuoteDate } from "@/utils/quoteDisplay";

export const ANALYTICS_PERIODS = ["7d", "30d", "12m", "year"];

function parseDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function dayKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function monthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function formatBucketLabel(key, period, lang) {
  const locale = lang === "en" ? "en-US" : "fr-FR";
  if (period === "7d" || period === "30d") {
    const date = new Date(`${key}T12:00:00`);
    return date.toLocaleDateString(locale, { day: "numeric", month: "short" });
  }
  const [year, month] = key.split("-").map(Number);
  const date = new Date(year, month - 1, 1);
  if (period === "year") {
    return date.toLocaleDateString(locale, { month: "short" });
  }
  return date.toLocaleDateString(locale, { month: "short", year: "2-digit" });
}

function buildBuckets(period, now = new Date()) {
  const buckets = [];
  if (period === "7d") {
    for (let offset = 6; offset >= 0; offset -= 1) {
      const date = startOfDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() - offset));
      buckets.push({ key: dayKey(date), date });
    }
    return buckets;
  }
  if (period === "30d") {
    for (let offset = 29; offset >= 0; offset -= 1) {
      const date = startOfDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() - offset));
      buckets.push({ key: dayKey(date), date });
    }
    return buckets;
  }
  if (period === "year") {
    for (let month = 0; month < 12; month += 1) {
      const date = new Date(now.getFullYear(), month, 1);
      buckets.push({ key: monthKey(date), date });
    }
    return buckets;
  }
  // 12m
  for (let offset = 11; offset >= 0; offset -= 1) {
    const date = startOfMonth(new Date(now.getFullYear(), now.getMonth() - offset, 1));
    buckets.push({ key: monthKey(date), date });
  }
  return buckets;
}

function resolveBucketKey(date, period) {
  if (!date) return null;
  if (period === "7d" || period === "30d") return dayKey(startOfDay(date));
  return monthKey(startOfMonth(date));
}

function isInPeriod(date, period, now) {
  if (!date) return false;
  if (period === "7d") {
    const start = startOfDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6));
    return date >= start;
  }
  if (period === "30d") {
    const start = startOfDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29));
    return date >= start;
  }
  if (period === "year") {
    return date.getFullYear() === now.getFullYear();
  }
  const start = startOfMonth(new Date(now.getFullYear(), now.getMonth() - 11, 1));
  return date >= start;
}

function countByStatus(items, statusKey, normalize = (s) => s) {
  const counts = {};
  for (const item of items || []) {
    const status = normalize(item.status);
    counts[status] = (counts[status] || 0) + 1;
  }
  return statusKey.reduce((acc, key) => {
    acc[key] = counts[key] || 0;
    return acc;
  }, {});
}

export function computeCommercialPipeline(quotes, invoices) {
  const quoteCounts = countByStatus(quotes, ["draft", "sent", "accepted", "rejected"]);
  const invoiceCounts = countByStatus(
    (invoices || []).filter((inv) => normalizeInvoiceStatus(inv.status) !== "cancelled"),
    ["in_progress", "paid", "overdue"],
    normalizeInvoiceStatus
  );
  return {
    quotes: {
      draft: quoteCounts.draft,
      sent: quoteCounts.sent,
      accepted: quoteCounts.accepted,
      rejected: quoteCounts.rejected,
    },
    invoices: {
      pending: invoiceCounts.in_progress,
      paid: invoiceCounts.paid,
      overdue: invoiceCounts.overdue,
    },
  };
}

export function computeDashboardKpis({
  statsKpis,
  quotes,
  invoices,
  clients,
  lang = "fr",
  now = new Date(),
}) {
  const month = now.getMonth();
  const year = now.getFullYear();

  let previousMonthRevenue = 0;
  let acceptedQuotes = 0;
  let paidInvoices = 0;
  let pendingInvoices = 0;

  for (const quote of quotes || []) {
    if (quote.status === "accepted") acceptedQuotes += 1;
  }

  for (const invoice of invoices || []) {
    const status = normalizeInvoiceStatus(invoice.status);
    if (status === "cancelled") continue;
    if (status === "paid") paidInvoices += 1;
    if (status === "in_progress" || status === "overdue") pendingInvoices += 1;

    const paid = getInvoiceAmountPaid(invoice);
    if (paid <= 0) continue;
    const paidDate = parseDate(invoice.paidAt || getInvoiceDate(invoice));
    if (!paidDate) continue;
    if (paidDate.getFullYear() === year && paidDate.getMonth() === month - 1) {
      previousMonthRevenue += paid;
    } else if (month === 0 && paidDate.getFullYear() === year - 1 && paidDate.getMonth() === 11) {
      previousMonthRevenue += paid;
    }
  }

  const monthRevenue = statsKpis?.monthlyRevenue?.total ?? 0;
  let revenueTrendPercent = null;
  if (previousMonthRevenue > 0) {
    revenueTrendPercent = Math.round(((monthRevenue - previousMonthRevenue) / previousMonthRevenue) * 100);
  } else if (monthRevenue > 0) {
    revenueTrendPercent = 100;
  }

  let newClientsThisMonth = 0;
  for (const client of clients || []) {
    const created = parseDate(client.createdAt);
    if (created && created.getMonth() === month && created.getFullYear() === year) {
      newClientsThisMonth += 1;
    }
  }

  return {
    revenue: {
      value: monthRevenue,
      formatted: formatInvoiceAmount(monthRevenue, lang),
      trendPercent: revenueTrendPercent,
      helperCount: statsKpis?.monthlyRevenue?.count ?? 0,
    },
    clients: {
      total: statsKpis?.clientsTotal ?? clients?.length ?? 0,
      newThisMonth: newClientsThisMonth,
    },
    quotes: {
      pending: statsKpis?.pendingQuotes ?? 0,
      accepted: acceptedQuotes,
      total: statsKpis?.quotesTotal ?? quotes?.length ?? 0,
    },
    invoices: {
      paid: paidInvoices,
      pending: pendingInvoices || statsKpis?.unpaidInvoices || 0,
      total: statsKpis?.invoicesTotal ?? invoices?.length ?? 0,
    },
  };
}

export function computeAnalyticsSeries({ invoices, quotes, clients, period = "30d", lang = "fr", now = new Date() }) {
  const buckets = buildBuckets(period, now).map((bucket) => ({
    key: bucket.key,
    label: formatBucketLabel(bucket.key, period, lang),
    revenue: 0,
    quotes: 0,
    invoices: 0,
    clients: 0,
  }));
  const index = new Map(buckets.map((bucket, i) => [bucket.key, i]));

  for (const invoice of invoices || []) {
    const status = normalizeInvoiceStatus(invoice.status);
    if (status === "cancelled") continue;

    const created = parseDate(invoice.createdAt || getInvoiceDate(invoice));
    if (created && isInPeriod(created, period, now)) {
      const key = resolveBucketKey(created, period);
      const idx = index.get(key);
      if (idx != null) buckets[idx].invoices += 1;
    }

    const paid = getInvoiceAmountPaid(invoice);
    if (paid <= 0) continue;
    const paidDate = parseDate(invoice.paidAt || getInvoiceDate(invoice));
    if (!paidDate || !isInPeriod(paidDate, period, now)) continue;
    const key = resolveBucketKey(paidDate, period);
    const idx = index.get(key);
    if (idx != null) buckets[idx].revenue += paid;
  }

  for (const quote of quotes || []) {
    const created = parseDate(quote.createdAt || getQuoteDate(quote));
    if (!created || !isInPeriod(created, period, now)) continue;
    const key = resolveBucketKey(created, period);
    const idx = index.get(key);
    if (idx != null) buckets[idx].quotes += 1;
  }

  for (const client of clients || []) {
    const created = parseDate(client.createdAt);
    if (!created || !isInPeriod(created, period, now)) continue;
    const key = resolveBucketKey(created, period);
    const idx = index.get(key);
    if (idx != null) buckets[idx].clients += 1;
  }

  // For 30d charts, downsample labels visually but keep daily data — UI can hide some ticks.
  return buckets.map((bucket) => ({
    ...bucket,
    revenueEuros: Math.round((bucket.revenue / 100) * 100) / 100,
    formattedRevenue: formatInvoiceAmount(bucket.revenue, lang),
  }));
}

export function enrichTopClients(topClients, clients) {
  const byId = new Map((clients || []).map((client) => [client.id, client]));
  return (topClients || []).map((item) => {
    const client = byId.get(item.clientId);
    return {
      ...item,
      lastContactAt: client ? getClientLastActivityAt(client) : null,
    };
  });
}

export function formatTrendPercent(value) {
  if (value == null) return null;
  const sign = value > 0 ? "+" : "";
  return `${sign}${value}%`;
}
