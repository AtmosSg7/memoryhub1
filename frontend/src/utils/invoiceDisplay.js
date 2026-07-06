export const INVOICE_STATUSES = ["in_progress", "paid", "overdue", "cancelled"];

const LEGACY_STATUSES = new Set(["draft", "sent"]);

export function normalizeInvoiceStatus(status) {
  if (!status || LEGACY_STATUSES.has(status)) return "in_progress";
  if (INVOICE_STATUSES.includes(status)) return status;
  return "in_progress";
}

export function invoiceMatchesStatus(invoice, statusFilter) {
  if (!statusFilter) return true;
  return normalizeInvoiceStatus(invoice?.status) === statusFilter;
}

export { getInvoiceStatusStyle } from "@/utils/statusDisplay";

export function getInvoiceAmountPaid(invoice) {
  const paid = Math.max(0, invoice?.amountPaid || 0);
  if (paid === 0 && normalizeInvoiceStatus(invoice?.status) === "paid") {
    return invoice?.amountTTC || 0;
  }
  return paid;
}

export function getInvoiceAmountDue(invoice) {
  const total = invoice?.amountTTC || 0;
  return Math.max(0, total - getInvoiceAmountPaid(invoice));
}

export function isInvoicePartiallyPaid(invoice) {
  const status = normalizeInvoiceStatus(invoice?.status);
  if (status === "cancelled" || status === "paid") return false;
  const paid = getInvoiceAmountPaid(invoice);
  const total = invoice?.amountTTC || 0;
  return paid > 0 && paid < total;
}

export function getInvoiceDisplayStatus(invoice) {
  if (isInvoicePartiallyPaid(invoice)) return "partial";
  return normalizeInvoiceStatus(invoice?.status);
}

export function getInvoicePaymentSummary(invoice) {
  const total = invoice?.amountTTC || 0;
  const paid = getInvoiceAmountPaid(invoice);
  const due = getInvoiceAmountDue(invoice);
  return {
    total,
    paid,
    due,
    isPaid: due === 0 && paid > 0,
    isPartial: paid > 0 && due > 0,
    isUnpaid: paid === 0,
  };
}

export const PAYMENT_METHODS = ["transfer", "card", "cash", "check", "other"];

export function formatInvoiceAmount(cents, lang = "fr") {
  const value = (cents || 0) / 100;
  return new Intl.NumberFormat(lang === "fr" ? "fr-FR" : "en-US", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
  }).format(value);
}

export function formatInvoiceDate(dateValue, lang = "fr") {
  if (!dateValue) return "";
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return dateValue;
  return date.toLocaleDateString(lang === "fr" ? "fr-FR" : "en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function getInvoiceDate(invoice) {
  return invoice?.invoiceDate || invoice?.createdAt || "";
}

export function computeInvoiceKpis(invoices, lang = "fr") {
  const now = new Date();
  const month = now.getMonth();
  const year = now.getFullYear();

  let monthTotal = 0;
  let monthCount = 0;
  let paidTotal = 0;
  let paidCount = 0;
  let overdueTotal = 0;
  let overdueCount = 0;

  for (const inv of invoices) {
    const status = normalizeInvoiceStatus(inv.status);
    if (status === "cancelled") continue;

    const paid = getInvoiceAmountPaid(inv);
    const due = getInvoiceAmountDue(inv);

    const date = new Date(getInvoiceDate(inv));
    if (
      !Number.isNaN(date.getTime()) &&
      date.getMonth() === month &&
      date.getFullYear() === year
    ) {
      monthTotal += inv.amountTTC || 0;
      monthCount += 1;
    }
    paidTotal += paid;
    if (paid > 0) paidCount += 1;
    if (status === "overdue" && due > 0) {
      overdueTotal += due;
      overdueCount += 1;
    }
  }

  const invoiceCount = (n) =>
    lang === "fr"
      ? n === 1
        ? "1 facture"
        : `${n} factures`
      : n === 1
        ? "1 invoice"
        : `${n} invoices`;

  return {
    monthTotal,
    monthCount,
    paidTotal,
    paidCount,
    overdueTotal,
    overdueCount,
    monthTrend: invoiceCount(monthCount),
    paidTrend: invoiceCount(paidCount),
    overdueTrend: invoiceCount(overdueCount),
  };
}

export {
  eurosToCents,
  centsToEurosInput,
  toDatetimeLocalValue,
  datetimeLocalToIso,
} from "@/utils/quoteDisplay";
