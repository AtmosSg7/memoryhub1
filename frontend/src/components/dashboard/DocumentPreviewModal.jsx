import { useEffect, useState } from "react";
import { Loader2, Download } from "lucide-react";
import { useDashboardLang } from "@/hooks/useDashboardLang";
import { fetchDocumentBlob, triggerBlobDownload } from "@/lib/documentsApi";
import { canPreviewDocument, getDocumentExtension } from "@/utils/documentDisplay";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const MODAL_OVERLAY_CLASS = "z-[100] bg-[#0A0A0B]/50 backdrop-blur-md";

const MODAL_CONTENT_CLASS =
  "z-[100] w-[calc(100%-2rem)] max-w-4xl max-h-[90vh] overflow-hidden flex flex-col bg-white border border-[#E7E9EE] rounded-[22px] p-6 sm:p-8 shadow-[0_1px_0_rgba(255,255,255,0.9)_inset,0_20px_60px_-15px_rgba(10,10,11,0.35)] sm:rounded-[22px] [&>button]:rounded-lg [&>button]:text-[#8A8F98] [&>button]:hover:bg-black/[0.04] [&>button]:hover:opacity-100";

export default function DocumentPreviewModal({ document: doc, open, onOpenChange }) {
  const { t } = useDashboardLang();
  const [blobUrl, setBlobUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (!open || !doc) {
      setBlobUrl(null);
      setError(null);
      return undefined;
    }

    if (!canPreviewDocument(doc)) {
      setBlobUrl(null);
      setError(null);
      return undefined;
    }

    let cancelled = false;
    let objectUrl = null;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const blob = await fetchDocumentBlob(doc.id, "preview");
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setBlobUrl(objectUrl);
      } catch (err) {
        if (!cancelled) {
          setError(err.message || t("documents.errors.previewFailed"));
          setBlobUrl(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [open, doc, t]);

  const handleDownload = async () => {
    if (!doc) return;
    setDownloading(true);
    try {
      const blob = await fetchDocumentBlob(doc.id, "download");
      triggerBlobDownload(blob, doc.name);
    } catch (err) {
      setError(err.message || t("documents.errors.downloadFailed"));
    } finally {
      setDownloading(false);
    }
  };

  const ext = doc ? getDocumentExtension(doc) : "";
  const isPdf = ext === "pdf";
  const isImage = ["jpg", "jpeg", "png", "webp"].includes(ext);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        overlayClassName={MODAL_OVERLAY_CLASS}
        className={MODAL_CONTENT_CLASS}
        data-testid="document-preview-modal"
      >
        <DialogHeader>
          <DialogTitle className="font-cabinet text-xl font-bold tracking-[-0.02em] text-[#111827] truncate">
            {doc?.name}
          </DialogTitle>
          <DialogDescription className="text-[#4B5563]">
            {doc?.clientName || t("documents.noClient")}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-[320px] max-h-[60vh] overflow-auto rounded-xl border border-[#E5E7EB] bg-[#FAFAFA] flex items-center justify-center">
          {loading ? (
            <div className="flex items-center text-sm text-[#6B7280]">
              <Loader2 className="w-5 h-5 animate-spin mr-2" />
              {t("documents.loadingPreview")}
            </div>
          ) : error ? (
            <p className="text-sm text-[#991B1B] px-4 text-center">{error}</p>
          ) : blobUrl && isPdf ? (
            <iframe
              src={blobUrl}
              title={doc.name}
              className="w-full h-[60vh] min-h-[320px] bg-white"
            />
          ) : blobUrl && isImage ? (
            <img
              src={blobUrl}
              alt={doc.name}
              className="max-w-full max-h-[60vh] object-contain"
            />
          ) : (
            <p className="text-sm text-[#6B7280] px-4 text-center">
              {t("documents.previewUnavailable")}
            </p>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={handleDownload}
            disabled={downloading}
            className="rounded-xl border-[#E5E7EB] gap-1.5"
          >
            {downloading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            {t("documents.download")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
