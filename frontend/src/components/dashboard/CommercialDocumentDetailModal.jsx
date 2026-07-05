import { Pencil } from "lucide-react";
import { useDashboardLang } from "@/hooks/useDashboardLang";
import CommercialLineItemsDetail from "@/components/dashboard/CommercialLineItemsDetail";
import CommercialPdfDownload from "@/components/dashboard/CommercialPdfDownload";
import { formatQuoteDate, getQuoteDate, getQuoteStatusStyle } from "@/utils/quoteDisplay";
import { formatInvoiceDate, getInvoiceDate, getInvoiceStatusStyle, normalizeInvoiceStatus } from "@/utils/invoiceDisplay";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const MODAL_OVERLAY_CLASS = "z-[100] bg-[#0A0A0B]/50 backdrop-blur-md";
const MODAL_CONTENT_CLASS =
  "z-[100] w-[calc(100%-2rem)] max-w-4xl max-h-[90vh] overflow-y-auto bg-white border border-[#E7E9EE] rounded-[22px] p-6 sm:p-8 shadow-[0_1px_0_rgba(255,255,255,0.9)_inset,0_20px_60px_-15px_rgba(10,10,11,0.35)] sm:rounded-[22px] [&>button]:rounded-lg";

export default function CommercialDocumentDetailModal({ type, document, open, onOpenChange, onEdit }) {
  const { t, lang } = useDashboardLang();
  if (!document) return null;

  const isQuote = type === "quote";
  const i18nPrefix = isQuote ? "quoteForm" : "invoiceForm";
  const statusStyle = isQuote ? getQuoteStatusStyle(document.status) : getInvoiceStatusStyle(document.status);
  const statusKey = isQuote ? document.status : normalizeInvoiceStatus(document.status);
  const statusLabel = t(isQuote ? `quoteStatus.${statusKey}` : `invoiceStatus.${statusKey}`);
  const dateLabel = isQuote ? t("quoteForm.quoteDate") : t("invoiceForm.invoiceDate");
  const dateValue = isQuote ? formatQuoteDate(getQuoteDate(document), lang) : formatInvoiceDate(getInvoiceDate(document), lang);
  const notes = (document.internalNotes || "").trim();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent overlayClassName={MODAL_OVERLAY_CLASS} className={MODAL_CONTENT_CLASS} data-testid={`${type}-detail-modal`}>
        <DialogHeader>
          <DialogTitle className="font-cabinet text-xl font-bold tracking-[-0.02em] text-[#111827]">
            {t(isQuote ? "commercialDetail.quoteTitle" : "commercialDetail.invoiceTitle")}
          </DialogTitle>
          <DialogDescription className="text-[#4B5563]">{document.number}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`inline-flex px-2.5 py-0.5 rounded-full text-[11px] font-medium border ${statusStyle.bg} ${statusStyle.text} ${statusStyle.border}`}>
              {statusLabel}
            </span>
            <span className="text-xs text-[#6B7280]">{dateLabel} : {dateValue}</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <div className="rounded-xl border border-[#E7E9EE] bg-[#FAFAFA] px-4 py-3">
              <div className="text-[10px] uppercase tracking-wide text-[#9CA3AF] font-semibold mb-1">{t(`${i18nPrefix}.client`)}</div>
              <div className="font-medium text-[#111827]">{document.clientName || "—"}</div>
            </div>
            <div className="rounded-xl border border-[#E7E9EE] bg-[#FAFAFA] px-4 py-3">
              <div className="text-[10px] uppercase tracking-wide text-[#9CA3AF] font-semibold mb-1">{t(`${i18nPrefix}.title`)}</div>
              <div className="font-medium text-[#111827]">{document.title || "—"}</div>
            </div>
          </div>

          <div>
            <div className="text-sm font-medium text-[#374151] mb-2">{t(`${i18nPrefix}.lineItems.title`)}</div>
            <CommercialLineItemsDetail document={document} i18nPrefix={i18nPrefix} t={t} lang={lang} />
          </div>

          {notes && (
            <div className="rounded-xl border border-[#E7E9EE] bg-white px-4 py-3">
              <div className="text-[10px] uppercase tracking-wide text-[#9CA3AF] font-semibold mb-2">{t(`${i18nPrefix}.internalNotes`)}</div>
              <p className="text-sm text-[#374151] whitespace-pre-wrap">{notes}</p>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0 pt-2 flex-col sm:flex-row sm:justify-between">
          <CommercialPdfDownload type={type} item={document} />
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="rounded-xl">
              {t("commercialDetail.close")}
            </Button>
            {onEdit && (
              <Button type="button" onClick={() => onEdit(document)} className="rounded-xl bg-[#0A2540] text-white hover:bg-[#173A5E] gap-1.5">
                <Pencil className="w-3.5 h-3.5" />
                {t("commercialDetail.edit")}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
