import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Copy, Download, Loader2, Mail } from "lucide-react";
import { toast } from "sonner";
import { useDashboardLang } from "@/hooks/useDashboardLang";
import { useFollowUpContext } from "@/context/FollowUpContext";
import { previewDocumentSend, recordDocumentSend, resolvePortalUrl } from "@/lib/documentSendsApi";
import { downloadInvoicePdf, downloadQuotePdf } from "@/lib/commercialPdfApi";
import { ActionButton } from "@/components/dashboard/ActionButton";
import {
  DETAIL_MODAL_CONTENT_CLASS,
  DETAIL_MODAL_OVERLAY_CLASS,
  FORM_FIELD_CLASS,
  FORM_LABEL_CLASS,
} from "@/components/dashboard/detailModalLayout";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export default function DocumentSendModal({ entityType, entityId, open, onOpenChange, onRecorded }) {
  const { t, lang } = useDashboardLang();
  const navigate = useNavigate();
  const { notifyFollowUpsChanged } = useFollowUpContext();
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [clientEmail, setClientEmail] = useState("");
  const [clientId, setClientId] = useState("");
  const [clientName, setClientName] = useState("");
  const [documentNumber, setDocumentNumber] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [portalUrl, setPortalUrl] = useState("");

  useEffect(() => {
    if (!open || !entityType || !entityId) return;
    let cancelled = false;
    setLoading(true);
    previewDocumentSend({ entityType, entityId, lang })
      .then((data) => {
        if (cancelled) return;
        setClientEmail(data.clientEmail || "");
        setClientId(data.clientId || "");
        setClientName(data.clientName || "");
        setDocumentNumber(data.documentNumber || "");
        setSubject(data.subject || "");
        setMessage(data.message || "");
        setPortalUrl(data.portalUrl ? resolvePortalUrl(data.portalUrl) : "");
      })
      .catch((err) => {
        if (!cancelled) {
          toast.error(err.message || t("documentSend.error"));
          onOpenChange(false);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, entityType, entityId, lang, onOpenChange, t]);

  const buildClipboardText = () => {
    const lines = [];
    if (clientEmail.trim()) lines.push(`To: ${clientEmail.trim()}`);
    if (subject.trim()) lines.push(`Subject: ${subject.trim()}`);
    lines.push("");
    lines.push(message.trim());
    if (portalUrl) {
      lines.push("");
      lines.push(`${t("documentSend.portalLabel")}: ${portalUrl}`);
    }
    return lines.join("\n");
  };

  const handleCopyMessage = async () => {
    if (!message.trim()) return;
    setSubmitting(true);
    try {
      await navigator.clipboard.writeText(buildClipboardText());
      await recordDocumentSend({
        entityType,
        entityId,
        message: message.trim(),
        subject: subject.trim() || undefined,
        lang,
      });
      notifyFollowUpsChanged();
      onRecorded?.();
      toast.success(t("documentSend.copied"));
      onOpenChange(false);
    } catch (err) {
      toast.error(err.message || t("documentSend.error"));
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopyPortal = async () => {
    if (!portalUrl) return;
    try {
      await navigator.clipboard.writeText(portalUrl);
      toast.success(t("documentSend.portalCopied"));
    } catch (err) {
      toast.error(err.message || t("documentSend.error"));
    }
  };

  const handleDownloadPdf = async () => {
    setDownloading(true);
    try {
      if (entityType === "quote") {
        await downloadQuotePdf(entityId, { lang, number: documentNumber });
      } else {
        await downloadInvoicePdf(entityId, { lang, number: documentNumber });
      }
    } catch (err) {
      toast.error(err.message || t("toast.pdfDownloadError"));
    } finally {
      setDownloading(false);
    }
  };

  const handleEditClient = () => {
    onOpenChange(false);
    if (clientId) navigate(`/dashboard/clients/${clientId}`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        overlayClassName={DETAIL_MODAL_OVERLAY_CLASS}
        className={`${DETAIL_MODAL_CONTENT_CLASS} max-w-2xl`}
        data-testid="document-send-modal"
      >
        <DialogHeader className="space-y-1 pb-1">
          <DialogTitle className="font-cabinet text-xl font-bold tracking-[-0.02em] text-[#111827]">
            {t("documentSend.title")}
          </DialogTitle>
          <DialogDescription className="text-[#4B5563]">
            {clientName
              ? t("documentSend.subtitle").replace("{client}", clientName)
              : t("documentSend.subtitleGeneric")}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-10 text-[#6B7280]">
            <Loader2 className="w-5 h-5 animate-spin mr-2" />
            {t("documentSend.loading")}
          </div>
        ) : (
          <div className="space-y-4">
            {!clientEmail ? (
              <div
                className="rounded-xl border border-[#FDE68A] bg-[#FFFBEB] px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
                data-testid="document-send-no-email"
              >
                <p className="text-sm text-[#92400E]">{t("documentSend.noEmail")}</p>
                <ActionButton variant="secondary" onClick={handleEditClient} className="shrink-0">
                  {t("documentSend.editClient")}
                </ActionButton>
              </div>
            ) : null}

            <div className="space-y-2">
              <Label className={FORM_LABEL_CLASS}>{t("documentSend.email")}</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA3AF]" />
                <Input
                  value={clientEmail}
                  readOnly
                  placeholder={t("documentSend.emailMissingPlaceholder")}
                  className={`${FORM_FIELD_CLASS} pl-9`}
                  data-testid="document-send-email"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className={FORM_LABEL_CLASS}>{t("documentSend.subject")}</Label>
              <Input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className={FORM_FIELD_CLASS}
                data-testid="document-send-subject"
              />
            </div>

            <div className="space-y-2">
              <Label className={FORM_LABEL_CLASS}>{t("documentSend.message")}</Label>
              <Textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={10}
                className={`${FORM_FIELD_CLASS} min-h-[220px] resize-y`}
                data-testid="document-send-message"
              />
            </div>

            {portalUrl ? (
              <div className="space-y-2">
                <Label className={FORM_LABEL_CLASS}>{t("documentSend.portalLink")}</Label>
                <div className="flex gap-2">
                  <Input value={portalUrl} readOnly className={`${FORM_FIELD_CLASS} flex-1 text-xs`} />
                  <ActionButton variant="secondary" onClick={handleCopyPortal} className="shrink-0 gap-1.5">
                    <Copy className="w-3.5 h-3.5" />
                    {t("documentSend.copyPortal")}
                  </ActionButton>
                </div>
              </div>
            ) : null}

            <p className="text-xs text-[#6B7280]">{t("documentSend.hint")}</p>
          </div>
        )}

        <DialogFooter className="flex-col sm:flex-row gap-2 sm:gap-2">
          <ActionButton variant="secondary" onClick={() => onOpenChange(false)} disabled={submitting || downloading}>
            {t("actions.close")}
          </ActionButton>
          <ActionButton
            variant="secondary"
            onClick={handleDownloadPdf}
            disabled={loading || downloading}
            className="gap-1.5"
            data-testid="document-send-pdf-btn"
          >
            {downloading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
            {t("actions.downloadPdf")}
          </ActionButton>
          <ActionButton
            variant="primary"
            onClick={handleCopyMessage}
            disabled={loading || submitting || !message.trim()}
            className="gap-1.5"
            data-testid="document-send-copy-btn"
          >
            {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Copy className="w-3.5 h-3.5" />}
            {t("documentSend.copy")}
          </ActionButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
