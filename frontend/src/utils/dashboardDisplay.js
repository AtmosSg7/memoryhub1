import { normalizeInvoiceStatus, getInvoiceAmountPaid, getInvoiceDate } from "@/utils/invoiceDisplay";

const PENDING_QUOTE_STATUSES = new Set(["sent"]);

export function countPendingQuotes(quotes) {
  return quotes.filter((q) => PENDING_QUOTE_STATUSES.has(q.status)).length;
}

export function countUnpaidInvoices(invoices) {
  return invoices.filter((inv) => {
    const status = normalizeInvoiceStatus(inv.status);
    return (status === "in_progress" || status === "overdue") && getInvoiceAmountPaid(inv) < (inv.amountTTC || 0);
  }).length;
}

export function computeMonthlyRevenue(invoices) {
  const now = new Date();
  const month = now.getMonth();
  const year = now.getFullYear();
  let total = 0;
  let count = 0;

  for (const inv of invoices) {
    const paid = getInvoiceAmountPaid(inv);
    if (paid <= 0) continue;
    const date = new Date(inv.paidAt || getInvoiceDate(inv));
    if (
      !Number.isNaN(date.getTime()) &&
      date.getMonth() === month &&
      date.getFullYear() === year
    ) {
      total += paid;
      count += 1;
    }
  }

  return { total, count };
}

export function computeTopClients(quotes, invoices, limit = 5) {
  const totals = new Map();

  for (const quote of quotes) {
    if (!["accepted", "sent"].includes(quote.status)) continue;
    const entry = totals.get(quote.clientId) || {
      clientId: quote.clientId,
      clientName: quote.clientName || "",
      total: 0,
      quoteCount: 0,
      invoiceCount: 0,
    };
    entry.total += quote.amountTTC || 0;
    entry.quoteCount += 1;
    entry.clientName = entry.clientName || quote.clientName || "";
    totals.set(quote.clientId, entry);
  }

  for (const inv of invoices) {
    const status = normalizeInvoiceStatus(inv.status);
    if (status === "cancelled") continue;
    const entry = totals.get(inv.clientId) || {
      clientId: inv.clientId,
      clientName: inv.clientName || "",
      total: 0,
      quoteCount: 0,
      invoiceCount: 0,
    };
    entry.total += inv.amountTTC || 0;
    entry.invoiceCount += 1;
    entry.clientName = entry.clientName || inv.clientName || "";
    totals.set(inv.clientId, entry);
  }

  return [...totals.values()]
    .sort((a, b) => b.total - a.total)
    .slice(0, limit);
}
