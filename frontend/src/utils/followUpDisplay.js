import { getInvoiceAmountDue, normalizeInvoiceStatus } from "@/utils/invoiceDisplay";

export function canFollowUpQuote(quote) {
  return quote?.status === "sent";
}

export function canFollowUpInvoice(invoice) {
  if (!invoice?.id) return false;
  const status = normalizeInvoiceStatus(invoice.status);
  if (status === "cancelled" || status === "paid") return false;
  return getInvoiceAmountDue(invoice) > 0;
}

export function getFollowUpEntityType(entity, type) {
  if (type === "quote" || type === "invoice") return type;
  if (entity?.number?.startsWith("FAC") || entity?.invoiceDate) return "invoice";
  if (entity?.quoteDate !== undefined || entity?.status === "sent") return "quote";
  return null;
}
