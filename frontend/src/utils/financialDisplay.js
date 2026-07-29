import {
  formatInvoiceAmount,
  getInvoiceAmountDue,
  getInvoiceAmountPaid,
  getInvoiceDate,
  normalizeInvoiceStatus,
} from "@/utils/invoiceDisplay";

function monthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function parseDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function computeFinancialOverview(invoices, lang = "fr") {
  const now = new Date();
  const currentKey = monthKey(now);

  let monthRevenue = 0;
  let monthPaidCount = 0;
  let pendingAmount = 0;
  let pendingCount = 0;
  let overdueAmount = 0;
  let overdueCount = 0;
  let previousMonthRevenue = 0;

  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const previousKey = monthKey(prev);

  const chartBuckets = [];
  for (let offset = 5; offset >= 0; offset -= 1) {
    const bucketDate = new Date(now.getFullYear(), now.getMonth() - offset, 1);
    chartBuckets.push({
      key: monthKey(bucketDate),
      label: bucketDate.toLocaleDateString(lang === "fr" ? "fr-FR" : "en-US", {
        month: "short",
      }),
      total: 0,
    });
  }
  const bucketIndex = new Map(chartBuckets.map((bucket, index) => [bucket.key, index]));

  for (const invoice of invoices || []) {
    const status = normalizeInvoiceStatus(invoice.status);
    if (status === "cancelled") continue;

    const paid = getInvoiceAmountPaid(invoice);
    const due = getInvoiceAmountDue(invoice);
    const paidDate = parseDate(invoice.paidAt || getInvoiceDate(invoice));

    if (paid > 0 && paidDate) {
      const key = monthKey(paidDate);
      const bucketIdx = bucketIndex.get(key);
      if (bucketIdx != null) {
        chartBuckets[bucketIdx].total += paid;
      }
      if (key === currentKey) {
        monthRevenue += paid;
        monthPaidCount += 1;
      }
      if (key === previousKey) {
        previousMonthRevenue += paid;
      }
    }

    if (due > 0 && (status === "in_progress" || status === "overdue")) {
      pendingAmount += due;
      pendingCount += 1;
    }

    if (status === "overdue" && due > 0) {
      overdueAmount += due;
      overdueCount += 1;
    }
  }

  let trendPercent = null;
  if (previousMonthRevenue > 0) {
    trendPercent = Math.round(((monthRevenue - previousMonthRevenue) / previousMonthRevenue) * 100);
  } else if (monthRevenue > 0) {
    trendPercent = 100;
  }

  const maxChartTotal = Math.max(...chartBuckets.map((bucket) => bucket.total), 1);

  return {
    monthRevenue,
    monthPaidCount,
    pendingAmount,
    pendingCount,
    overdueAmount,
    overdueCount,
    trendPercent,
    chartBuckets: chartBuckets.map((bucket) => ({
      ...bucket,
      heightPercent: Math.max(8, Math.round((bucket.total / maxChartTotal) * 100)),
      formattedTotal: formatInvoiceAmount(bucket.total, lang),
    })),
    formattedMonthRevenue: formatInvoiceAmount(monthRevenue, lang),
    formattedPendingAmount: formatInvoiceAmount(pendingAmount, lang),
    formattedOverdueAmount: formatInvoiceAmount(overdueAmount, lang),
  };
}
