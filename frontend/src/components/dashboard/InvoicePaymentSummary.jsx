import { formatInvoiceAmount, getInvoicePaymentSummary } from "@/utils/invoiceDisplay";

export default function InvoicePaymentSummary({ invoice, lang, t, compact = false }) {
  const summary = getInvoicePaymentSummary(invoice);
  if (summary.isUnpaid && summary.total === summary.due) {
    return compact ? null : (
      <div className="text-sm text-[#6B7280]">
        {t("invoicePayment.due")} : <span className="font-semibold text-[#111827]">{formatInvoiceAmount(summary.due, lang)}</span>
      </div>
    );
  }

  if (summary.isPaid) {
    return (
      <div className={compact ? "text-xs text-[#047857]" : "rounded-xl border border-[#A7F3D0] bg-[#ECFDF5] px-4 py-3 text-sm text-[#065F46]"}>
        {t("invoicePayment.paid")} : <span className="font-semibold">{formatInvoiceAmount(summary.paid, lang)}</span>
        {!compact && invoice?.paidAt ? (
          <span className="block text-xs mt-1 text-[#047857]">{t("invoicePayment.paidOn")} {new Date(invoice.paidAt).toLocaleDateString(lang === "fr" ? "fr-FR" : "en-US")}</span>
        ) : null}
      </div>
    );
  }

  return (
    <div
      className={compact ? "text-xs space-y-0.5" : "rounded-xl border border-[#FDE68A] bg-[#FFFBEB] px-4 py-3 space-y-1"}
      data-testid="invoice-payment-summary"
    >
      <div className={compact ? "text-[#92400E]" : "text-sm text-[#92400E]"}>
        {t("invoicePayment.paid")} : <span className="font-semibold">{formatInvoiceAmount(summary.paid, lang)}</span>
        {" · "}
        {t("invoicePayment.remaining")} : <span className="font-semibold">{formatInvoiceAmount(summary.due, lang)}</span>
      </div>
      {!compact ? (
        <div className="text-xs text-[#B45309]">
          {t("invoicePayment.total")} {formatInvoiceAmount(summary.total, lang)}
        </div>
      ) : null}
    </div>
  );
}
