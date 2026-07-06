import { getQuoteDate } from "@/utils/quoteDisplay";
import { getInvoiceDate, normalizeInvoiceStatus, getInvoiceAmountPaid, getInvoiceAmountDue } from "@/utils/invoiceDisplay";

function sortByDateDesc(items, getDate) {
  return [...items].sort((a, b) => {
    const da = new Date(getDate(a)).getTime();
    const db = new Date(getDate(b)).getTime();
    return (Number.isNaN(db) ? 0 : db) - (Number.isNaN(da) ? 0 : da);
  });
}

export function computeClientCommercialStats(quotes = [], invoices = []) {
  let revenue = 0;
  let unpaidCount = 0;
  let unpaidAmount = 0;

  for (const inv of invoices) {
    const status = normalizeInvoiceStatus(inv.status);
    if (status === "cancelled") continue;
    const paid = getInvoiceAmountPaid(inv);
    const due = getInvoiceAmountDue(inv);
    revenue += paid;
    if (due > 0 && (status === "in_progress" || status === "overdue")) {
      unpaidCount += 1;
      unpaidAmount += due;
    }
  }

  const lastQuote = sortByDateDesc(quotes, getQuoteDate)[0] || null;
  const lastInvoice = sortByDateDesc(invoices, getInvoiceDate)[0] || null;

  return {
    revenue,
    quotesCount: quotes.length,
    invoicesCount: invoices.length,
    unpaidCount,
    unpaidAmount,
    lastQuote,
    lastInvoice,
  };
}
