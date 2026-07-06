export const STATUS_PALETTE = {
  draft: {
    bg: "bg-[#F3F4F6]",
    text: "text-[#4B5563]",
    border: "border-[#E5E7EB]",
    dot: "bg-[#9CA3AF]",
  },
  sent: {
    bg: "bg-[#EFF6FF]",
    text: "text-[#1E40AF]",
    border: "border-[#DBEAFE]",
    dot: "bg-[#3B82F6]",
  },
  accepted: {
    bg: "bg-[#ECFDF5]",
    text: "text-[#047857]",
    border: "border-[#A7F3D0]",
    dot: "bg-[#10B981]",
  },
  rejected: {
    bg: "bg-[#FDF2F8]",
    text: "text-[#9D174D]",
    border: "border-[#FBCFE8]",
    dot: "bg-[#DB2777]",
  },
  expired: {
    bg: "bg-[#FFFBEB]",
    text: "text-[#B45309]",
    border: "border-[#FDE68A]",
    dot: "bg-[#F59E0B]",
  },
  in_progress: {
    bg: "bg-[#EFF6FF]",
    text: "text-[#1E40AF]",
    border: "border-[#DBEAFE]",
    dot: "bg-[#3B82F6]",
  },
  paid: {
    bg: "bg-[#ECFDF5]",
    text: "text-[#047857]",
    border: "border-[#A7F3D0]",
    dot: "bg-[#10B981]",
  },
  overdue: {
    bg: "bg-[#FFF7ED]",
    text: "text-[#C2410C]",
    border: "border-[#FED7AA]",
    dot: "bg-[#EA580C]",
  },
  partial: {
    bg: "bg-[#FFFBEB]",
    text: "text-[#B45309]",
    border: "border-[#FDE68A]",
    dot: "bg-[#F59E0B]",
  },
  cancelled: {
    bg: "bg-[#F3F4F6]",
    text: "text-[#6B7280]",
    border: "border-[#E5E7EB]",
    dot: "bg-[#9CA3AF]",
  },
  new: {
    bg: "bg-[#EFF6FF]",
    text: "text-[#1E40AF]",
    border: "border-[#DBEAFE]",
    dot: "bg-[#3B82F6]",
  },
  active: {
    bg: "bg-[#ECFDF5]",
    text: "text-[#047857]",
    border: "border-[#A7F3D0]",
    dot: "bg-[#10B981]",
  },
  pending: {
    bg: "bg-[#FFFBEB]",
    text: "text-[#B45309]",
    border: "border-[#FDE68A]",
    dot: "bg-[#F59E0B]",
  },
  dormant: {
    bg: "bg-[#F3F4F6]",
    text: "text-[#6B7280]",
    border: "border-[#E5E7EB]",
    dot: "bg-[#9CA3AF]",
  },
};

const QUOTE_STATUSES = new Set(["draft", "sent", "accepted", "rejected", "expired"]);
const CLIENT_STATUSES = new Set(["new", "active", "pending", "dormant"]);
const INVOICE_LEGACY = new Set(["draft", "sent"]);

export function resolveInvoiceStatusKey(status) {
  if (!status || INVOICE_LEGACY.has(status)) return "in_progress";
  if (STATUS_PALETTE[status] && ["in_progress", "paid", "overdue", "cancelled", "partial"].includes(status)) {
    return status;
  }
  return "in_progress";
}

export function resolveQuoteStatusKey(status) {
  if (status && QUOTE_STATUSES.has(status)) return status;
  return "draft";
}

export function resolveClientStatusKey(status) {
  if (status && CLIENT_STATUSES.has(status)) return status;
  return "new";
}

export function getStatusStyle(kind, status) {
  let key = status;
  if (kind === "quote") key = resolveQuoteStatusKey(status);
  else if (kind === "invoice") key = resolveInvoiceStatusKey(status);
  else if (kind === "client") key = resolveClientStatusKey(status);
  return STATUS_PALETTE[key] || STATUS_PALETTE.draft;
}

export function getStatusTranslationKey(kind, status) {
  if (kind === "quote") return `quoteStatus.${resolveQuoteStatusKey(status)}`;
  if (kind === "invoice") return `invoiceStatus.${resolveInvoiceStatusKey(status)}`;
  return `status.${resolveClientStatusKey(status)}`;
}

export function getQuoteStatusStyle(status) {
  return getStatusStyle("quote", status);
}

export function getInvoiceStatusStyle(status) {
  return getStatusStyle("invoice", status);
}

export function getClientStatusStyle(status) {
  return getStatusStyle("client", status);
}
