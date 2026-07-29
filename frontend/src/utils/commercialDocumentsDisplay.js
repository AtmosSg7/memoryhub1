import { formatQuoteAmount, getQuoteDate, QUOTE_STATUSES } from "@/utils/quoteDisplay";
import {
  formatInvoiceAmount,
  getInvoiceDate,
  getInvoiceAmountDue,
  getInvoiceAmountPaid,
  normalizeInvoiceStatus,
  INVOICE_STATUSES,
} from "@/utils/invoiceDisplay";

export { commercialDocumentsPath } from "@/utils/commercialDocumentsPath";

export const COMMERCIAL_KINDS = ["all", "quote", "invoice"];

export function isValidQuoteStatus(status) {
  return Boolean(status) && QUOTE_STATUSES.includes(status);
}

export function isValidInvoiceStatus(status) {
  return Boolean(status) && INVOICE_STATUSES.includes(status);
}

export function buildCommercialDocumentRows(quotes = [], invoices = []) {
  const quoteRows = quotes.map((quote) => ({
    kind: "quote",
    id: quote.id,
    number: quote.number,
    clientName: quote.clientName,
    clientId: quote.clientId,
    amountTTC: quote.amountTTC,
    status: quote.status,
    title: quote.title,
    sortAt: getQuoteDate(quote),
    raw: quote,
  }));

  const invoiceRows = invoices.map((invoice) => ({
    kind: "invoice",
    id: invoice.id,
    number: invoice.number,
    clientName: invoice.clientName,
    clientId: invoice.clientId,
    amountTTC: invoice.amountTTC,
    status: invoice.status,
    title: invoice.title,
    sortAt: getInvoiceDate(invoice),
    raw: invoice,
  }));

  return [...quoteRows, ...invoiceRows].sort((a, b) => {
    const ta = new Date(a.sortAt).getTime();
    const tb = new Date(b.sortAt).getTime();
    if (Number.isNaN(ta) && Number.isNaN(tb)) return 0;
    if (Number.isNaN(ta)) return 1;
    if (Number.isNaN(tb)) return -1;
    return tb - ta;
  });
}

export function filterCommercialDocumentRows(rows, kindFilter = "all", statusFilter = "") {
  let filtered = rows;
  if (kindFilter && kindFilter !== "all") {
    filtered = filtered.filter((row) => row.kind === kindFilter);
  }
  if (!statusFilter) return filtered;

  return filtered.filter((row) => {
    if (row.kind === "invoice") {
      return normalizeInvoiceStatus(row.status) === statusFilter;
    }
    return row.status === statusFilter;
  });
}

export function formatCommercialDocumentAmount(row, lang) {
  if (row.kind === "invoice") {
    return formatInvoiceAmount(row.amountTTC, lang);
  }
  return formatQuoteAmount(row.amountTTC, lang);
}

export function getInvoiceAmountHint(invoice, lang, t) {
  const paid = getInvoiceAmountPaid(invoice);
  const due = getInvoiceAmountDue(invoice);
  if (paid > 0 && due > 0) {
    return `${t("invoicePayment.remaining")} ${formatInvoiceAmount(due, lang)}`;
  }
  return null;
}
