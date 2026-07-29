import { CheckCircle2, Info, XCircle } from "lucide-react";
import { formatQuoteDate } from "@/utils/quoteDisplay";
import { formatInvoiceDate } from "@/utils/invoiceDisplay";

function formatRespondedAt(value, lang) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(lang === "fr" ? "fr-FR" : "en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function PortalDocumentStatusBanner({ type, document, lang, t }) {
  if (!document) return null;

  const isQuote = type === "quote";

  if (isQuote && document.status === "accepted") {
    return (
      <div
        className="rounded-xl border border-[#A7F3D0] bg-[#ECFDF5] px-4 py-3.5 flex gap-3"
        data-testid="portal-status-accepted"
      >
        <CheckCircle2 className="w-5 h-5 text-[#047857] shrink-0 mt-0.5" aria-hidden="true" />
        <div className="min-w-0 space-y-1">
          <p className="text-sm font-semibold text-[#065F46]">{t("portal.statusAcceptedTitle")}</p>
          <p className="text-sm text-[#047857] leading-relaxed">{t("portal.statusAcceptedDesc")}</p>
          {document.respondedAt ? (
            <p className="text-xs text-[#059669]">
              {t("portal.respondedAt")} {formatRespondedAt(document.respondedAt, lang)}
              {document.clientSignerName ? ` · ${document.clientSignerName}` : ""}
            </p>
          ) : null}
          {document.clientComment ? (
            <p className="text-xs text-[#047857]/90 italic">« {document.clientComment} »</p>
          ) : null}
        </div>
      </div>
    );
  }

  if (isQuote && document.status === "rejected") {
    return (
      <div
        className="rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] px-4 py-3.5 flex gap-3"
        data-testid="portal-status-rejected"
      >
        <XCircle className="w-5 h-5 text-[#6B7280] shrink-0 mt-0.5" aria-hidden="true" />
        <div className="min-w-0 space-y-1">
          <p className="text-sm font-semibold text-[#374151]">{t("portal.statusRejectedTitle")}</p>
          <p className="text-sm text-[#6B7280] leading-relaxed">{t("portal.statusRejectedDesc")}</p>
          {document.respondedAt ? (
            <p className="text-xs text-[#6B7280]">
              {t("portal.respondedAt")} {formatRespondedAt(document.respondedAt, lang)}
              {document.clientSignerName ? ` · ${document.clientSignerName}` : ""}
            </p>
          ) : null}
        </div>
      </div>
    );
  }

  if (!isQuote && (document.isPaid || document.status === "paid")) {
    const paidLabel = document.paidAt
      ? formatInvoiceDate(document.paidAt, lang)
      : formatRespondedAt(document.paidAt, lang);
    return (
      <div
        className="rounded-xl border border-[#A7F3D0] bg-[#ECFDF5] px-4 py-3.5 flex gap-3"
        data-testid="portal-status-paid"
      >
        <CheckCircle2 className="w-5 h-5 text-[#047857] shrink-0 mt-0.5" aria-hidden="true" />
        <div className="min-w-0 space-y-1">
          <p className="text-sm font-semibold text-[#065F46]">{t("portal.statusPaidTitle")}</p>
          <p className="text-sm text-[#047857] leading-relaxed">{t("portal.statusPaidDesc")}</p>
          {paidLabel ? (
            <p className="text-xs text-[#059669]">
              {t("portal.paidAt")} {paidLabel}
            </p>
          ) : null}
        </div>
      </div>
    );
  }

  if (!isQuote && document.status === "overdue") {
    return (
      <div
        className="rounded-xl border border-[#FED7AA] bg-[#FFF7ED] px-4 py-3.5 flex gap-3"
        data-testid="portal-status-overdue"
      >
        <Info className="w-5 h-5 text-[#C2410C] shrink-0 mt-0.5" aria-hidden="true" />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-[#9A3412]">{t("portal.statusOverdueTitle")}</p>
          <p className="text-sm text-[#C2410C] leading-relaxed mt-1">{t("portal.statusOverdueDesc")}</p>
        </div>
      </div>
    );
  }

  return null;
}
