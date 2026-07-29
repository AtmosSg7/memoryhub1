import { useCallback, useEffect, useState } from "react";
import { Copy, Download, Loader2, Mail, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { toastApiError } from "@/utils/apiErrors";
import { useDashboardLang } from "@/hooks/useDashboardLang";
import { useFollowUpContext } from "@/context/FollowUpContext";
import { useAddQuote } from "@/context/AddQuoteContext";
import { useAddClient } from "@/context/AddClientContext";
import { previewDocumentSend, recordDocumentSend, sendDocumentEmail, emailDeliveryToast, resolvePortalUrl } from "@/lib/documentSendsApi";
import { enableClientPortal } from "@/lib/portalApi";
import { downloadInvoicePdf, downloadQuotePdf } from "@/lib/commercialPdfApi";
import { InlineLoader } from "@/components/dashboard/PageFeedback";
import { ActionButton } from "@/components/dashboard/ActionButton";
import {
  NESTED_MODAL_CONTENT_CLASS_2XL,
  NESTED_MODAL_OVERLAY_CLASS,
  FORM_FIELD_CLASS,
  FORM_LABEL_CLASS,
  FORM_LARGE_TEXTAREA_CLASS,
  DETAIL_MODAL_HEADER_CLASS,
  DETAIL_MODAL_TITLE_CLASS,
  WorkflowModalFooter,
} from "@/components/dashboard/detailModalLayout";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export default function DocumentSendModal({ entityType, entityId, open, onOpenChange, onRecorded }) {
  const { t, lang } = useDashboardLang();
  const { notifyFollowUpsChanged } = useFollowUpContext();
  const { notifyQuotesChanged } = useAddQuote();
  const { openEditClient, refreshKey: clientRefreshKey } = useAddClient();
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [previewError, setPreviewError] = useState(null);
  const [clientEmail, setClientEmail] = useState("");
  const [clientId, setClientId] = useState("");
  const [clientName, setClientName] = useState("");
  const [documentNumber, setDocumentNumber] = useState("");
  const [subject, setSubject] = useState("");
  const [preheader, setPreheader] = useState("");
  const [message, setMessage] = useState("");
  const [portalUrl, setPortalUrl] = useState("");
  const [enablingPortal, setEnablingPortal] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);

  const loadPreview = useCallback(async () => {
    if (!entityType || !entityId) return;
    setLoading(true);
    setPreviewError(null);
    try {
      const data = await previewDocumentSend({ entityType, entityId, lang });
      setClientEmail(data.clientEmail || "");
      setClientId(data.clientId || "");
      setClientName(data.clientName || "");
      setDocumentNumber(data.documentNumber || "");
      setSubject(data.subject || "");
      setPreheader(data.preheader || "");
      setMessage(data.message || "");
      setPortalUrl(data.portalUrl ? resolvePortalUrl(data.portalUrl) : "");
    } catch (err) {
      setPreviewError(err.message || t("documentSend.error"));
    } finally {
      setLoading(false);
    }
  }, [entityType, entityId, lang, t]);

  useEffect(() => {
    if (!open || !entityType || !entityId) return;
    loadPreview();
  }, [open, entityType, entityId, lang, clientRefreshKey, loadPreview]);

  const buildClipboardText = () => {
    const lines = [];
    if (clientEmail.trim()) lines.push(`${t("documentSend.clipboardTo")} ${clientEmail.trim()}`);
    if (subject.trim()) lines.push(`${t("documentSend.clipboardSubject")} ${subject.trim()}`);
    lines.push("");
    lines.push(message.trim());
    return lines.join("\n");
  };

  const handleSendEmail = async () => {
    const email = clientEmail.trim();
    if (!email) return;
    setSendingEmail(true);
    try {
      const data = await sendDocumentEmail({
        entityType,
        entityId,
        recipientEmail: email,
        lang,
      });
      notifyFollowUpsChanged();
      if (entityType === "quote") notifyQuotesChanged();
      onRecorded?.();
      toast.success(emailDeliveryToast(data.emailStatus, t));
      onOpenChange(false);
    } catch (err) {
      toastApiError(err, t, "documentSend.error");
    } finally {
      setSendingEmail(false);
    }
  };

  const handleCopyMessage = async () => {
    if (!message.trim()) return;
    setSubmitting(true);
    try {
      const clipboardText = buildClipboardText();
      try {
        await navigator.clipboard.writeText(clipboardText);
      } catch {
        // Headless browsers and some staging contexts block the Clipboard API.
      }
      await recordDocumentSend({
        entityType,
        entityId,
        message: message.trim(),
        subject: subject.trim() || undefined,
        lang,
      });
      notifyFollowUpsChanged();
      if (entityType === "quote") notifyQuotesChanged();
      onRecorded?.();
      toast.success(t("documentSend.copied"));
      onOpenChange(false);
    } catch (err) {
      toastApiError(err, t, "documentSend.error");
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
      toastApiError(err, t, "documentSend.error");
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
      toastApiError(err, t, "toast.pdfDownloadError");
    } finally {
      setDownloading(false);
    }
  };

  const handleEnablePortal = async () => {
    if (!clientId || enablingPortal) return;
    setEnablingPortal(true);
    try {
      const data = await enableClientPortal(clientId);
      setPortalUrl(resolvePortalUrl(data.portalUrl));
      toast.success(t("clientPortal.enabled"));
      await loadPreview();
    } catch (err) {
      toastApiError(err, t, "clientPortal.error");
    } finally {
      setEnablingPortal(false);
    }
  };

  const handleEditClient = () => {
    if (!clientId) return;
    openEditClient({ id: clientId, email: clientEmail, name: clientName });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        overlayClassName={NESTED_MODAL_OVERLAY_CLASS}
        className={NESTED_MODAL_CONTENT_CLASS_2XL}
        data-testid="document-send-modal"
      >
        <DialogHeader className={DETAIL_MODAL_HEADER_CLASS}>
          <DialogTitle className={DETAIL_MODAL_TITLE_CLASS}>
            {t("documentSend.title")}
          </DialogTitle>
          <DialogDescription className="text-[#4B5563]">
            {clientName
              ? t("documentSend.subtitle").replace("{client}", clientName)
              : t("documentSend.subtitleGeneric")}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <InlineLoader label={t("documentSend.loading")} testId="document-send-loading" />
        ) : previewError ? (
          <div className="rounded-xl border border-[#FECACA] bg-[#FEF2F2] px-4 py-4 space-y-3">
            <p className="text-sm text-[#991B1B]">{previewError}</p>
            <ActionButton variant="secondary" onClick={loadPreview} className="gap-1.5">
              <RefreshCw className="w-3.5 h-3.5" />
              {t("documentSend.retry")}
            </ActionButton>
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
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <Label className={FORM_LABEL_CLASS}>{t("documentSend.preheader")}</Label>
              <Input
                value={preheader}
                onChange={(e) => setPreheader(e.target.value)}
                className={FORM_FIELD_CLASS}
                data-testid="document-send-preheader"
              />
              <p className="text-xs text-[#6B7280]">{t("documentSend.preheaderHint")}</p>
            </div>

            <div className="space-y-2">
              <Label className={FORM_LABEL_CLASS}>{t("documentSend.message")}</Label>
              <Textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={10}
                className={FORM_LARGE_TEXTAREA_CLASS}
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
            ) : clientId ? (
              <div
                className="rounded-xl border border-[#BFDBFE] bg-[#EFF6FF] px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
                data-testid="document-send-no-portal"
              >
                <p className="text-sm text-[#1E40AF]">{t("documentSend.noPortal")}</p>
                <ActionButton
                  variant="primary"
                  onClick={handleEnablePortal}
                  disabled={enablingPortal}
                  className="shrink-0 gap-1.5"
                  data-testid="document-send-enable-portal"
                >
                  {enablingPortal ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                  {t("clientPortal.enable")}
                </ActionButton>
              </div>
            ) : null}

            <p className="text-xs text-[#6B7280]">{t("documentSend.hint")}</p>
          </div>
        )}

        <WorkflowModalFooter>
          <ActionButton variant="secondary" onClick={() => onOpenChange(false)} disabled={submitting || downloading || sendingEmail}>
            {t("actions.close")}
          </ActionButton>
          <ActionButton
            variant="secondary"
            onClick={handleDownloadPdf}
            disabled={loading || downloading || Boolean(previewError) || sendingEmail}
            className="gap-1.5"
            data-testid="document-send-pdf-btn"
          >
            {downloading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
            {t("actions.downloadPdf")}
          </ActionButton>
          {clientEmail.trim() ? (
            <ActionButton
              variant="primary"
              onClick={handleSendEmail}
              disabled={loading || sendingEmail || Boolean(previewError)}
              className="gap-1.5"
              data-testid="document-send-email-btn"
            >
              {sendingEmail ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Mail className="w-3.5 h-3.5" />}
              {sendingEmail ? t("documentSend.sendingEmail") : t("documentSend.sendEmail")}
            </ActionButton>
          ) : null}
          <ActionButton
            variant={clientEmail.trim() ? "secondary" : "primary"}
            onClick={handleCopyMessage}
            disabled={loading || submitting || Boolean(previewError) || !message.trim() || sendingEmail}
            className="gap-1.5"
            data-testid="document-send-copy-btn"
          >
            {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Copy className="w-3.5 h-3.5" />}
            {t("documentSend.copy")}
          </ActionButton>
        </WorkflowModalFooter>
      </DialogContent>
    </Dialog>
  );
}
