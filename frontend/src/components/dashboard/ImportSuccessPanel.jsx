import { useEffect, useState } from "react";
import { CheckCircle2, Download, Eye, LayoutDashboard, Loader2, Sparkles, Upload } from "lucide-react";
import { toast } from "sonner";
import { toastApiError } from "@/utils/apiErrors";
import { useDashboardLang } from "@/hooks/useDashboardLang";
import { ActionButton } from "@/components/dashboard/ActionButton";
import {
  DetailModalSummary,
  DetailModalSummaryItem,
} from "@/components/dashboard/detailModalLayout";
import StatusBadge from "@/components/dashboard/StatusBadge";
import { downloadInvoicePdf, downloadQuotePdf } from "@/lib/commercialPdfApi";
import { formatQuoteAmount, formatQuoteDate } from "@/utils/quoteDisplay";

export default function ImportSuccessPanel({ summary, onView, onImportAnother, onBackToDashboard }) {
  const { t, lang } = useDashboardLang();
  const [downloading, setDownloading] = useState(false);
  const [animated, setAnimated] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setAnimated(true), 50);
    return () => window.clearTimeout(timer);
  }, []);

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
      toastApiError(err, t, "toast.pdfDownloadError");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="space-y-5" data-testid="import-wizard-success">
      <div
        className={[
          "rounded-2xl border border-[#A7F3D0] bg-gradient-to-br from-[#ECFDF5] to-white p-6 text-center transition-all duration-500",
          animated ? "opacity-100 scale-100" : "opacity-0 scale-95",
        ].join(" ")}
      >
        <div className="relative w-16 h-16 mx-auto mb-4">
          <span className="absolute inset-0 rounded-full bg-[#A7F3D0]/40 animate-ping" />
          <div className="relative w-16 h-16 rounded-full bg-white border-2 border-[#A7F3D0] flex items-center justify-center">
            <CheckCircle2 className="w-8 h-8 text-[#059669]" />
          </div>
        </div>
        <div className="flex items-center justify-center gap-2 mb-1">
          <Sparkles className="w-4 h-4 text-[#059669]" />
          <h3 className="font-cabinet text-xl font-bold text-[#065F46]">
            {t("importWizard.successTitle")}
          </h3>
        </div>
        <p className="text-sm text-[#047857]">{t("importWizard.successSubtitle")}</p>
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

      <div className="flex flex-col gap-2 pt-2 border-t border-[#F3F4F6]">
        <ActionButton variant="primary" onClick={onView} className="gap-1.5 w-full justify-center" data-testid="import-success-view">
          <Eye className="w-4 h-4" />
          {isQuote ? t("importWizard.success.viewQuote") : t("importWizard.success.viewInvoice")}
        </ActionButton>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <ActionButton variant="secondary" onClick={onImportAnother} className="gap-1.5 justify-center">
            <Upload className="w-4 h-4" />
            {t("importWizard.importAnotherAnalysis")}
          </ActionButton>
          <ActionButton variant="secondary" onClick={onBackToDashboard} className="gap-1.5 justify-center">
            <LayoutDashboard className="w-4 h-4" />
            {t("importWizard.backToDashboard")}
          </ActionButton>
        </div>
        <ActionButton
          variant="ghost"
          onClick={handleDownload}
          disabled={downloading}
          className="gap-1.5 justify-center text-[#6B7280]"
          data-testid="import-success-download-pdf"
        >
          {downloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          {t("actions.downloadPdf")}
        </ActionButton>
      </div>
    </div>
  );
}
