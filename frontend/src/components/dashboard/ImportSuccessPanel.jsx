import { useState } from "react";
import { CheckCircle2, Download, Eye, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { useDashboardLang } from "@/hooks/useDashboardLang";
import { ActionButton } from "@/components/dashboard/ActionButton";
import {
  DetailModalSummary,
  DetailModalSummaryItem,
} from "@/components/dashboard/detailModalLayout";
import StatusBadge from "@/components/dashboard/StatusBadge";
import { downloadInvoicePdf, downloadQuotePdf } from "@/lib/commercialPdfApi";
import { formatQuoteAmount, formatQuoteDate } from "@/utils/quoteDisplay";

export default function ImportSuccessPanel({ summary, onView, onImportAnother }) {
  const { t, lang } = useDashboardLang();
  const [downloading, setDownloading] = useState(false);

  if (!summary) return null;

  const isQuote = summary.entityType === "quote";
  const typeLabel = t(isQuote ? "importWizard.kind.quote" : "importWizard.kind.invoice");
  const dateValue = summary.documentDate
    ? formatQuoteDate(summary.documentDate, lang)
    : "—";

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const opts = { lang, number: summary.number };
      if (isQuote) {
        await downloadQuotePdf(summary.entityId, opts);
      } else {
        await downloadInvoicePdf(summary.entityId, opts);
      }
    } catch (err) {
      toast.error(err.message || t("toast.pdfDownloadError"));
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="space-y-5" data-testid="import-wizard-success">
      <div className="rounded-2xl border border-[#A7F3D0] bg-[#ECFDF5] p-5 text-center">
        <div className="w-12 h-12 rounded-full bg-white border border-[#A7F3D0] flex items-center justify-center mx-auto mb-3">
          <CheckCircle2 className="w-6 h-6 text-[#065F46]" />
        </div>
        <h3 className="font-cabinet text-lg font-bold text-[#065F46]">
          {t("importWizard.successTitle")}
        </h3>
        <p className="text-sm text-[#047857] mt-1">{t("importWizard.successSubtitle")}</p>
      </div>

      <DetailModalSummary>
        <DetailModalSummaryItem label={t("importWizard.fields.kind")}>
          {typeLabel}
        </DetailModalSummaryItem>
        <DetailModalSummaryItem label={t("importWizard.summary.client")}>
          {summary.clientName || "—"}
        </DetailModalSummaryItem>
        <DetailModalSummaryItem label={t("importWizard.fields.amountTTC")} highlight>
          {formatQuoteAmount(summary.amountTTC, lang)}
        </DetailModalSummaryItem>
        <DetailModalSummaryItem label={t("importWizard.fields.documentDate")}>
          {dateValue}
        </DetailModalSummaryItem>
      </DetailModalSummary>

      {summary.number ? (
        <div className="flex items-center justify-between rounded-xl border border-[#E7E9EE] bg-[#FAFAFA] px-4 py-3">
          <span className="text-sm text-[#6B7280]">{summary.number}</span>
          <StatusBadge kind={isQuote ? "quote" : "invoice"} status={isQuote ? "draft" : "in_progress"} size="sm" />
        </div>
      ) : null}

      <div className="flex flex-col-reverse sm:flex-row sm:flex-wrap gap-2 pt-1">
        <ActionButton variant="secondary" onClick={onImportAnother} className="gap-1.5 sm:flex-1">
          <Upload className="w-4 h-4" />
          {t("importWizard.importAnother")}
        </ActionButton>
        <ActionButton
          variant="secondary"
          onClick={handleDownload}
          disabled={downloading}
          className="gap-1.5 sm:flex-1"
          data-testid="import-success-download-pdf"
        >
          {downloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          {t("actions.downloadPdf")}
        </ActionButton>
        <ActionButton variant="primary" onClick={onView} className="gap-1.5 sm:flex-1" data-testid="import-success-view">
          <Eye className="w-4 h-4" />
          {t("importWizard.viewDocument")}
        </ActionButton>
      </div>
    </div>
  );
}
