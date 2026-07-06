import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
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
import { formatInvoiceAmount, formatInvoiceDate, normalizeInvoiceStatus } from "@/utils/invoiceDisplay";
import { downloadPortalInvoicePdf, downloadPortalQuotePdf } from "@/lib/portalPdfApi";
import PortalAcceptQuoteButton from "@/components/portal/PortalAcceptQuoteButton";

export default function PortalDocumentDetailModal({
  token,
  type,
  document,
  open,
  onOpenChange,
  canAcceptQuotes,
  lang,
  t,
  onQuoteAccepted,
}) {
  const [downloading, setDownloading] = useState(false);
  if (!document) return null;

  const isQuote = type === "quote";
  const status = isQuote ? document.status : normalizeInvoiceStatus(document.status);
  const dateValue = isQuote
    ? formatQuoteDate(document.quoteDate, lang)
    : formatInvoiceDate(document.invoiceDate, lang);
  const amountValue = isQuote
    ? formatQuoteAmount(document.amountTTC, lang)
    : formatInvoiceAmount(document.amountTTC, lang);
  const i18nPrefix = isQuote ? "portal.quoteFields" : "portal.invoiceFields";

  const handleDownload = async () => {
    setDownloading(true);
    try {
      if (isQuote) {
        await downloadPortalQuotePdf(token, document.id, { lang, number: document.number });
      } else {
        await downloadPortalInvoicePdf(token, document.id, { lang, number: document.number });
      }
    } catch (err) {
      toast.error(err.message || t("portal.pdfError"));
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
        <DialogHeader className="space-y-1 pb-1">
          <DialogTitle className="font-cabinet text-xl font-bold tracking-[-0.02em] text-[#111827]">
            {document.number}
          </DialogTitle>
          <DialogDescription className="text-[#4B5563]">{document.title}</DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <DetailModalSummary>
            <DetailModalSummaryItem label={t(`${i18nPrefix}.status`)}>
              <StatusBadge kind={isQuote ? "quote" : "invoice"} status={status} />
            </DetailModalSummaryItem>
            <DetailModalSummaryItem label={t(`${i18nPrefix}.amount`)} highlight>
              {amountValue}
            </DetailModalSummaryItem>
            <DetailModalSummaryItem label={t(`${i18nPrefix}.date`)}>{dateValue}</DetailModalSummaryItem>
          </DetailModalSummary>

          <DetailModalSection title={t(`${i18nPrefix}.lineItems`)}>
            <CommercialLineItemsDetail document={document} i18nPrefix="portal" t={t} lang={lang} />
          </DetailModalSection>
        </div>

        <DetailModalFooter>
          {isQuote && canAcceptQuotes ? (
            <PortalAcceptQuoteButton
              token={token}
              quote={document}
              lang={lang}
              t={t}
              onAccepted={(updated) => {
                onQuoteAccepted?.(updated);
              }}
              variant="secondary"
              className="h-10"
            />
          ) : null}
          <ActionButton variant="primary" onClick={handleDownload} disabled={downloading} className="gap-1.5">
            {downloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            {t("portal.downloadPdf")}
          </ActionButton>
        </DetailModalFooter>
      </DialogContent>
    </Dialog>
  );
}
