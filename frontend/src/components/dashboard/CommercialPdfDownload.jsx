import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useDashboardLang } from "@/hooks/useDashboardLang";
import { downloadInvoicePdf, downloadQuotePdf } from "@/lib/commercialPdfApi";
import { ActionButton } from "@/components/dashboard/ActionButton";

export default function CommercialPdfDownload({ type, item, compact = false }) {
  const { t, lang } = useDashboardLang();
  const [downloading, setDownloading] = useState(false);

  if (!item?.id) return null;

  const handleDownload = async () => {
    setDownloading(true);
    try {
      if (type === "quote") {
        await downloadQuotePdf(item.id, { lang, number: item.number });
      } else {
        await downloadInvoicePdf(item.id, { lang, number: item.number });
      }
    } catch (err) {
      toast.error(err.message || t("toast.pdfDownloadError"));
    } finally {
      setDownloading(false);
    }
  };

  if (compact) {
    return (
      <ActionButton
        variant="ghostIcon"
        onClick={handleDownload}
        disabled={downloading}
        title={t("actions.download")}
        aria-label={t("actions.download")}
        data-testid={`${type}-download-pdf-${item.id}`}
      >
        {downloading ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <Download className="w-3.5 h-3.5" />
        )}
      </ActionButton>
    );
  }

  return (
    <ActionButton
      variant="quick"
      onClick={handleDownload}
      disabled={downloading}
      className="h-10 px-4 text-sm"
      data-testid={`${type}-download-pdf-${item.id}`}
    >
      {downloading ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
      ) : (
        <Download className="w-3.5 h-3.5" />
      )}
      {t("actions.downloadPdf")}
    </ActionButton>
  );
}
