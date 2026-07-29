import EmptyState from "@/components/dashboard/EmptyState";
import InvoiceStatusBadge from "@/components/dashboard/InvoiceStatusBadge";
import StatusBadge from "@/components/dashboard/StatusBadge";
import { formatQuoteAmount, formatQuoteDate, getQuoteDate } from "@/utils/quoteDisplay";
import { formatInvoiceAmount, formatInvoiceDate, getInvoiceDate } from "@/utils/invoiceDisplay";
import { FileText, Receipt } from "lucide-react";

export default function ClientDocumentHighlight({
  type,
  document,
  emptyLabel,
  lang,
  t,
  onClick,
  onEmptyAction,
  emptyActionLabel,
}) {
  if (!document) {
    return (
      <EmptyState
        compact
        inline
        icon={type === "quote" ? FileText : Receipt}
        title={emptyLabel}
        cta={emptyActionLabel}
        onCta={onEmptyAction}
        testId={`client-last-${type}-empty`}
      />
    );
  }

  const isQuote = type === "quote";
  const amount = isQuote
    ? formatQuoteAmount(document.amountTTC, lang)
    : formatInvoiceAmount(document.amountTTC, lang);
  const date = isQuote
    ? formatQuoteDate(getQuoteDate(document), lang)
    : formatInvoiceDate(getInvoiceDate(document), lang);

  return (
    <button
      type="button"
      onClick={() => onClick(document)}
      className="w-full text-left rounded-xl border border-[#E5E7EB] bg-white px-4 py-3 hover:border-[#0A2540]/25 hover:bg-[#FAFAFA] transition-colors"
      data-testid={`client-last-${type}`}
    >
      <div className="flex items-center justify-between gap-2 mb-1">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-[#9CA3AF]">
          {isQuote ? t("clientDetail.lastQuote") : t("clientDetail.lastInvoice")}
        </span>
        {isQuote ? (
          <StatusBadge kind="quote" status={document.status} size="sm" />
        ) : (
          <InvoiceStatusBadge invoice={document} size="sm" />
        )}
      </div>
      <div className="font-medium text-sm text-[#111827] truncate">
        {document.number} · {document.title}
      </div>
      <div className="flex items-center justify-between gap-2 mt-1">
        <span className="font-cabinet text-base font-bold text-[#0A2540] tabular-nums">{amount}</span>
        <span className="text-[11px] text-[#9CA3AF]">{date}</span>
      </div>
    </button>
  );
}
