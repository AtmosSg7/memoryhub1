import { Pencil } from "lucide-react";
import { useDashboardLang } from "@/hooks/useDashboardLang";
import CommercialLineItemsDetail from "@/components/dashboard/CommercialLineItemsDetail";
import CommercialPdfDownload from "@/components/dashboard/CommercialPdfDownload";
import { formatQuoteAmount, formatQuoteDate, getQuoteDate } from "@/utils/quoteDisplay";
import { formatInvoiceAmount, formatInvoiceDate, getInvoiceDate, normalizeInvoiceStatus } from "@/utils/invoiceDisplay";
import StatusBadge from "@/components/dashboard/StatusBadge";
import InvoiceStatusBadge from "@/components/dashboard/InvoiceStatusBadge";
import InvoicePaymentSummary from "@/components/dashboard/InvoicePaymentSummary";
import InvoicePaymentAction from "@/components/dashboard/InvoicePaymentAction";
import FollowUpAction from "@/components/dashboard/FollowUpAction";
import DocumentSendAction from "@/components/dashboard/DocumentSendAction";
import FollowUpLastHint from "@/components/dashboard/FollowUpLastHint";
import { useFollowUpLastMap } from "@/hooks/useFollowUpLastMap";
import QuoteInvoiceAction from "@/components/dashboard/QuoteInvoiceAction";
import QuoteAcceptedBanner from "@/components/dashboard/QuoteAcceptedBanner";
import { ActionButton } from "@/components/dashboard/ActionButton";
import {
  DETAIL_MODAL_CONTENT_CLASS,
  DETAIL_MODAL_OVERLAY_CLASS,
  DetailModalFooter,
  DetailModalSection,
  DetailModalSummary,
  DetailModalSummaryItem,
} from "@/components/dashboard/detailModalLayout";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export default function CommercialDocumentDetailModal({ type, document, open, onOpenChange, onEdit }) {
  const { t, lang } = useDashboardLang();
  const { getLast } = useFollowUpLastMap(type, document ? [document] : []);
  const lastFollowUp = document ? getLast(document.id) : null;
  if (!document) return null;

  const isQuote = type === "quote";
  const i18nPrefix = isQuote ? "quoteForm" : "invoiceForm";
  const statusKey = isQuote ? document.status : normalizeInvoiceStatus(document.status);
  const dateLabel = isQuote ? t("quoteForm.quoteDate") : t("invoiceForm.invoiceDate");
  const dateValue = isQuote
    ? formatQuoteDate(getQuoteDate(document), lang)
    : formatInvoiceDate(getInvoiceDate(document), lang);
  const amountValue = isQuote
    ? formatQuoteAmount(document.amountTTC, lang)
    : formatInvoiceAmount(document.amountTTC, lang);
  const notes = (document.internalNotes || "").trim();
  const canCreateInvoice = isQuote && document.status === "accepted" && !document.invoiceId;

  const handleEdit = () => {
    if (onEdit) onEdit(document);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        overlayClassName={DETAIL_MODAL_OVERLAY_CLASS}
        className={DETAIL_MODAL_CONTENT_CLASS}
        data-testid={`${type}-detail-modal`}
      >
        <DialogHeader className="space-y-1 pb-1">
          <DialogTitle className="font-cabinet text-xl font-bold tracking-[-0.02em] text-[#111827]">
            {document.number}
          </DialogTitle>
          <DialogDescription className="text-[#4B5563]">
            {document.title || t(isQuote ? "commercialDetail.quoteTitle" : "commercialDetail.invoiceTitle")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {isQuote ? <QuoteAcceptedBanner quote={document} t={t} /> : null}
          <DetailModalSummary>
            <DetailModalSummaryItem label={t(`${i18nPrefix}.client`)}>
              {document.clientName || "—"}
            </DetailModalSummaryItem>
            <DetailModalSummaryItem label={t(`${i18nPrefix}.status`)}>
              {isQuote ? (
                <StatusBadge kind="quote" status={statusKey} />
              ) : (
                <InvoiceStatusBadge invoice={document} />
              )}
            </DetailModalSummaryItem>
            <DetailModalSummaryItem label={t("commercialDetail.amount")} highlight>
              {amountValue}
            </DetailModalSummaryItem>
            <DetailModalSummaryItem label={dateLabel}>{dateValue}</DetailModalSummaryItem>
          </DetailModalSummary>

          {lastFollowUp ? (
            <div className="rounded-xl border border-[#FED7AA] bg-[#FFF7ED] px-4 py-3">
              <FollowUpLastHint last={lastFollowUp} />
            </div>
          ) : null}

          {!isQuote ? <InvoicePaymentSummary invoice={document} lang={lang} t={t} /> : null}

          <DetailModalSection title={t(`${i18nPrefix}.lineItems.title`)}>
            <CommercialLineItemsDetail document={document} i18nPrefix={i18nPrefix} t={t} lang={lang} />
          </DetailModalSection>

          {notes ? (
            <DetailModalSection title={t(`${i18nPrefix}.internalNotes`)}>
              <div className="rounded-xl border border-[#E7E9EE] bg-white px-4 py-3">
                <p className="text-sm text-[#374151] whitespace-pre-wrap">{notes}</p>
              </div>
            </DetailModalSection>
          ) : null}
        </div>

        <DetailModalFooter
          secondary={
            <>
              <CommercialPdfDownload type={type} item={document} />
              <DocumentSendAction entityType={type} entity={document} />
              {!isQuote ? (
                <InvoicePaymentAction invoice={document} onUpdated={() => onOpenChange(false)} />
              ) : null}
              <FollowUpAction entityType={type} entity={document} />
            </>
          }
          primary={
            <>
              {canCreateInvoice ? (
                <QuoteInvoiceAction quote={document} prominent />
              ) : isQuote ? (
                <QuoteInvoiceAction quote={document} />
              ) : null}
              <ActionButton variant="secondary" onClick={() => onOpenChange(false)}>
                {t("actions.close")}
              </ActionButton>
              {onEdit && (
                <ActionButton variant={canCreateInvoice ? "secondary" : "primary"} onClick={handleEdit} className="gap-1.5">
                  <Pencil className="w-3.5 h-3.5" />
                  {t("actions.edit")}
                </ActionButton>
              )}
            </>
          }
        />
      </DialogContent>
    </Dialog>
  );
}
