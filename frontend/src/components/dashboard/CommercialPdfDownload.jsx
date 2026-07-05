import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useDashboardLang } from "@/hooks/useDashboardLang";
import { downloadInvoicePdf, downloadQuotePdf } from "@/lib/commercialPdfApi";
import { Button } from "@/components/ui/button";

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
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={handleDownload}
        disabled={downloading}
        className="h-8 w-8 p-0 text-[#6B7280] hover:text-[#111827]"
        title={t("commercialPdf.download")}
        aria-label={t("commercialPdf.download")}
        data-testid={`${type}-download-pdf-${item.id}`}
      >
        {downloading ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <Download className="w-3.5 h-3.5" />
        )}
      </Button>
    );
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={handleDownload}
      disabled={downloading}
      className="gap-1.5"
      data-testid={`${type}-download-pdf-${item.id}`}
    >
      {downloading ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
      ) : (
        <Download className="w-3.5 h-3.5" />
      )}
      {t("commercialPdf.download")}
    </Button>
  );
}
