export const INVOICE_STATUSES = ["in_progress", "paid", "overdue", "cancelled"];

const LEGACY_STATUSES = new Set(["draft", "sent"]);

const STATUS_STYLES = {
  in_progress: { bg: "bg-[#EFF6FF]", text: "text-[#0A2540]", border: "border-[#BFDBFE]" },
  paid: { bg: "bg-[#ECFDF5]", text: "text-[#065F46]", border: "border-[#A7F3D0]" },
  overdue: { bg: "bg-[#FEF2F2]", text: "text-[#991B1B]", border: "border-[#FECACA]" },
  cancelled: { bg: "bg-[#F3F4F6]", text: "text-[#6B7280]", border: "border-[#D1D5DB]" },
};

export function normalizeInvoiceStatus(status) {
  if (!status || LEGACY_STATUSES.has(status)) return "in_progress";
  if (INVOICE_STATUSES.includes(status)) return status;
  return "in_progress";
}

export function invoiceMatchesStatus(invoice, statusFilter) {
  if (!statusFilter) return true;
  return normalizeInvoiceStatus(invoice?.status) === statusFilter;
}

export function getInvoiceStatusStyle(status) {
  return STATUS_STYLES[normalizeInvoiceStatus(status)] || STATUS_STYLES.in_progress;
}

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

    const date = new Date(getInvoiceDate(inv));
    if (
      !Number.isNaN(date.getTime()) &&
      date.getMonth() === month &&
      date.getFullYear() === year
    ) {
      monthTotal += inv.amountTTC || 0;
      monthCount += 1;
    }
    if (status === "paid") {
      paidTotal += inv.amountTTC || 0;
      paidCount += 1;
    }
    if (status === "overdue") {
      overdueTotal += inv.amountTTC || 0;
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
