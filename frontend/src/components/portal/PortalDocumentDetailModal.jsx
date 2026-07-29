import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { toastApiError } from "@/utils/apiErrors";
import CommercialLineItemsDetail from "@/components/dashboard/CommercialLineItemsDetail";
import StatusBadge from "@/components/dashboard/StatusBadge";
import {
  DETAIL_MODAL_CONTENT_CLASS,
  DETAIL_MODAL_OVERLAY_CLASS,
  DetailModalFooter,
  DetailModalSection,
  DetailModalSummary,
  DetailModalSummaryItem,
} from "@/components/dashboard/detailModalLayout";
import { ActionButton } from "@/components/dashboard/ActionButton";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatQuoteAmount, formatQuoteDate } from "@/utils/quoteDisplay";
import {
  formatInvoiceAmount,
  formatInvoiceDate,
  getInvoiceDisplayStatus,
  getInvoicePaymentSummary,
} from "@/utils/invoiceDisplay";
import { downloadPortalInvoicePdf, downloadPortalQuotePdf } from "@/lib/portalPdfApi";
import PortalQuoteActions from "@/components/portal/PortalQuoteActions";
import PortalDocumentStatusBanner from "@/components/portal/PortalDocumentStatusBanner";

export default function PortalDocumentDetailModal({
  token,
  type,
  document,
  open,
  onOpenChange,
  canAcceptQuotes,
  canRejectQuotes = true,
  lang,
  t,
  onQuoteAccepted,
}) {
  const [downloading, setDownloading] = useState(false);
  if (!document) return null;

  const isQuote = type === "quote";
  const status = isQuote ? document.status : getInvoiceDisplayStatus(document);
  const dateValue = isQuote
    ? formatQuoteDate(document.quoteDate, lang)
    : formatInvoiceDate(document.invoiceDate, lang);
  const amountValue = isQuote
    ? formatQuoteAmount(document.amountTTC, lang)
    : formatInvoiceAmount(document.amountTTC, lang);
  const i18nPrefix = isQuote ? "portal.quoteFields" : "portal.invoiceFields";
  const payment = !isQuote ? getInvoicePaymentSummary(document) : null;
  const showActions = isQuote && (document.canAccept || document.canReject);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      if (isQuote) {
        await downloadPortalQuotePdf(token, document.id, { lang, number: document.number });
      } else {
        await downloadPortalInvoicePdf(token, document.id, { lang, number: document.number });
      }
      toast.success(t("portal.pdfSuccess"));
    } catch (err) {
      toastApiError(err, t, "portal.pdfError");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        overlayClassName={DETAIL_MODAL_OVERLAY_CLASS}
        className={DETAIL_MODAL_CONTENT_CLASS}
        data-testid={`portal-${type}-detail`}
      >
        <DialogHeader className="space-y-2 pb-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide bg-[#F3F4F6] text-[#6B7280] border border-[#E5E7EB]">
              {isQuote ? t("portal.documentTypeQuote") : t("portal.documentTypeInvoice")}
            </span>
            <StatusBadge kind={isQuote ? "quote" : "invoice"} status={status} size="sm" />
          </div>
          <DialogTitle className="font-cabinet text-xl font-bold tracking-[-0.02em] text-[#111827] tabular-nums">
            {document.number}
          </DialogTitle>
          <DialogDescription className="text-[#4B5563] leading-relaxed">{document.title}</DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <PortalDocumentStatusBanner type={type} document={document} lang={lang} t={t} />

          <DetailModalSummary>
            <DetailModalSummaryItem label={t(`${i18nPrefix}.amount`)} highlight>
              {amountValue}
            </DetailModalSummaryItem>
            <DetailModalSummaryItem label={t(`${i18nPrefix}.date`)}>{dateValue}</DetailModalSummaryItem>
            {!isQuote && payment?.paid > 0 ? (
              <DetailModalSummaryItem label={t("portal.amountPaid")}>
                {formatInvoiceAmount(payment.paid, lang)}
              </DetailModalSummaryItem>
            ) : null}
            {!isQuote && payment?.due > 0 ? (
              <DetailModalSummaryItem label={t("portal.amountDue")} highlight>
                {formatInvoiceAmount(payment.due, lang)}
              </DetailModalSummaryItem>
            ) : null}
          </DetailModalSummary>

          <DetailModalSection title={t(`${i18nPrefix}.lineItems`)}>
            <CommercialLineItemsDetail
              document={document}
              i18nPrefix="portal"
              t={t}
              lang={lang}
              variant="stacked"
            />
          </DetailModalSection>
        </div>

        <DetailModalFooter
          secondary={
            <ActionButton
              variant="quick"
              onClick={handleDownload}
              disabled={downloading}
              className="gap-1.5 w-full sm:w-auto"
            >
              {downloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              {t("portal.downloadPdf")}
            </ActionButton>
          }
          primary={
            showActions ? (
              <PortalQuoteActions
                token={token}
                quote={document}
                lang={lang}
                t={t}
                canReject={canRejectQuotes}
                onUpdated={(updated) => {
                  onQuoteAccepted?.(updated);
                }}
                layout="row"
                className="justify-end"
              />
            ) : (
              <ActionButton
                variant="primary"
                onClick={handleDownload}
                disabled={downloading}
                className="gap-1.5 w-full sm:w-auto"
              >
                {downloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                {t("portal.downloadPdf")}
              </ActionButton>
            )
          }
        />
      </DialogContent>
    </Dialog>
  );
}
