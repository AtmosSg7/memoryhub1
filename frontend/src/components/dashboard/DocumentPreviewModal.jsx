import { useEffect, useState } from "react";
import { Loader2, Download } from "lucide-react";
import { useDashboardLang } from "@/hooks/useDashboardLang";
import { fetchDocumentBlob, triggerBlobDownload } from "@/lib/documentsApi";
import { canPreviewDocument, getDocumentExtension } from "@/utils/documentDisplay";
import { ActionButton } from "@/components/dashboard/ActionButton";
import {
  DETAIL_MODAL_CONTENT_CLASS,
  DETAIL_MODAL_OVERLAY_CLASS,
  DetailModalFooter,
} from "@/components/dashboard/detailModalLayout";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const PREVIEW_CONTENT_CLASS = `${DETAIL_MODAL_CONTENT_CLASS} overflow-hidden flex flex-col max-w-4xl`;

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
        overlayClassName={DETAIL_MODAL_OVERLAY_CLASS}
        className={PREVIEW_CONTENT_CLASS}
        data-testid="document-preview-modal"
      >
        <DialogHeader className="space-y-1 pb-1">
          <DialogTitle className="font-cabinet text-xl font-bold tracking-[-0.02em] text-[#111827] truncate">
            {doc?.name}
          </DialogTitle>
          <DialogDescription className="text-[#4B5563]">
            {doc?.clientName || t("documents.noClient")}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-[320px] max-h-[60vh] overflow-auto rounded-xl border border-[#E7E9EE] bg-[#FAFAFA] flex items-center justify-center">
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

        <DetailModalFooter
          primary={
            <ActionButton variant="secondary" onClick={() => onOpenChange(false)}>
              {t("actions.close")}
            </ActionButton>
          }
          secondary={
            <ActionButton variant="quick" onClick={handleDownload} disabled={downloading} className="h-10 px-4 text-sm gap-1.5">
              {downloading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Download className="w-3.5 h-3.5" />
              )}
              {t("actions.downloadPdf")}
            </ActionButton>
          }
        />
      </DialogContent>
    </Dialog>
  );
}
