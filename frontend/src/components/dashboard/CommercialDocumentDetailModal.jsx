import { useDashboardLang } from "@/hooks/useDashboardLang";
import CommercialLineItemsDetail from "@/components/dashboard/CommercialLineItemsDetail";
import { formatQuoteAmount, formatQuoteDate, getQuoteDate } from "@/utils/quoteDisplay";
import { formatInvoiceAmount, formatInvoiceDate, getInvoiceDate, normalizeInvoiceStatus } from "@/utils/invoiceDisplay";
import StatusBadge from "@/components/dashboard/StatusBadge";
import InvoiceStatusBadge from "@/components/dashboard/InvoiceStatusBadge";
import InvoicePaymentSummary from "@/components/dashboard/InvoicePaymentSummary";
import FollowUpLastHint from "@/components/dashboard/FollowUpLastHint";
import { useFollowUpLastMap } from "@/hooks/useFollowUpLastMap";
import QuoteAcceptedBanner from "@/components/dashboard/QuoteAcceptedBanner";
import CommercialDocumentDetailFooter from "@/components/dashboard/CommercialDocumentDetailFooter";
import {
  DETAIL_MODAL_CONTENT_CLASS,
  DETAIL_MODAL_OVERLAY_CLASS,
  DetailModalSection,
  DetailModalSummary,
  DetailModalSummaryItem,
} from "@/components/dashboard/detailModalLayout";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export default function CommercialDocumentDetailModal({
  type,
  document,
  open,
  onOpenChange,
  onEdit,
  onDelete,
  onDocumentUpdated,
  onImportFinalInvoice,
}) {
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

  const handleEdit = () => {
    onOpenChange(false);
    onEdit?.(document);
  };

  const handleDelete = () => {
    onOpenChange(false);
    onDelete?.(document);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        overlayClassName={DETAIL_MODAL_OVERLAY_CLASS}
        className={DETAIL_MODAL_CONTENT_CLASS}
        data-testid={`${type}-detail-modal`}
      >
        <DialogHeader className="space-y-1 pb-1">
          <DialogTitle className="font-cabinet text-xl font-bold tracking-[-0.02em] text-dash-text">
            {document.number}
          </DialogTitle>
          <DialogDescription className="text-dash-text-muted">
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
            <div className="rounded-xl border border-[var(--dash-warning-border)] bg-[var(--dash-warning-bg)] px-4 py-3">
              <FollowUpLastHint last={lastFollowUp} />
            </div>
          ) : null}

          {!isQuote ? <InvoicePaymentSummary invoice={document} lang={lang} t={t} /> : null}

          <DetailModalSection title={t(`${i18nPrefix}.lineItems.title`)}>
            <CommercialLineItemsDetail document={document} i18nPrefix={i18nPrefix} t={t} lang={lang} />
          </DetailModalSection>

          {notes ? (
            <DetailModalSection title={t(`${i18nPrefix}.internalNotes`)}>
              <div className="rounded-xl border border-dash-border bg-dash-surface px-4 py-3">
                <p className="text-sm text-dash-text-muted whitespace-pre-wrap">{notes}</p>
              </div>
            </DetailModalSection>
          ) : null}
        </div>

        <CommercialDocumentDetailFooter
          type={type}
          document={document}
          onClose={() => onOpenChange(false)}
          onEdit={onEdit ? handleEdit : undefined}
          onDelete={onDelete ? handleDelete : undefined}
          onDocumentUpdated={onDocumentUpdated}
          onImportFinalInvoice={onImportFinalInvoice}
        />
      </DialogContent>
    </Dialog>
  );
}
