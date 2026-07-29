import { useCallback, useEffect, useState } from "react";
import { Copy, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { toastApiError } from "@/utils/apiErrors";
import { useDashboardLang } from "@/hooks/useDashboardLang";
import { useFollowUpContext } from "@/context/FollowUpContext";
import { previewFollowUp, recordFollowUp } from "@/lib/followUpsApi";
import { ActionButton } from "@/components/dashboard/ActionButton";
import {
  NESTED_MODAL_CONTENT_CLASS,
  NESTED_MODAL_OVERLAY_CLASS,
  FORM_FIELD_CLASS,
  FORM_LABEL_CLASS,
  FORM_LARGE_TEXTAREA_CLASS,
  DETAIL_MODAL_HEADER_CLASS,
  DETAIL_MODAL_TITLE_CLASS,
  WorkflowModalFooter,
} from "@/components/dashboard/detailModalLayout";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export default function FollowUpModal({ entityType, entityId, open, onOpenChange, onRecorded }) {
  const { t, lang } = useDashboardLang();
  const { notifyFollowUpsChanged } = useFollowUpContext();
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [previewError, setPreviewError] = useState(null);
  const [subject, setSubject] = useState("");
  const [preheader, setPreheader] = useState("");
  const [message, setMessage] = useState("");
  const [clientName, setClientName] = useState("");

  const loadPreview = useCallback(async () => {
    if (!entityType || !entityId) return;
    setLoading(true);
    setPreviewError(null);
    try {
      const data = await previewFollowUp({ entityType, entityId, lang });
      setSubject(data.subject || "");
      setPreheader(data.preheader || "");
      setMessage(data.message || "");
      setClientName(data.clientName || "");
    } catch (err) {
      setPreviewError(err.message || t("followUp.error"));
    } finally {
      setLoading(false);
    }
  }, [entityType, entityId, lang, t]);

  useEffect(() => {
    if (!open || !entityType || !entityId) return;
    loadPreview();
  }, [open, entityType, entityId, lang, loadPreview]);

  const handleCopy = async () => {
    if (!message.trim()) return;
    setSubmitting(true);
    try {
      const fullText = subject.trim()
        ? `${t("followUp.clipboardSubject")} ${subject.trim()}\n\n${message.trim()}`
        : message.trim();
      await navigator.clipboard.writeText(fullText);
      await recordFollowUp({
        entityType,
        entityId,
        message: message.trim(),
        subject: subject.trim() || undefined,
        lang,
      });
      notifyFollowUpsChanged();
      onRecorded?.();
      toast.success(t("followUp.copied"));
      onOpenChange(false);
    } catch (err) {
      toastApiError(err, t, "followUp.error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        overlayClassName={NESTED_MODAL_OVERLAY_CLASS}
        className={NESTED_MODAL_CONTENT_CLASS}
        data-testid="follow-up-modal"
      >
        <DialogHeader className={DETAIL_MODAL_HEADER_CLASS}>
          <DialogTitle className={DETAIL_MODAL_TITLE_CLASS}>
            {t("followUp.title")}
          </DialogTitle>
          <DialogDescription className="text-[#4B5563]">
            {clientName ? t("followUp.subtitle").replace("{client}", clientName) : t("followUp.subtitleGeneric")}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-10 text-[#6B7280]">
            <Loader2 className="w-5 h-5 animate-spin mr-2" />
            {t("followUp.loading")}
          </div>
        ) : previewError ? (
          <div className="rounded-xl border border-[#FECACA] bg-[#FEF2F2] px-4 py-4 space-y-3">
            <p className="text-sm text-[#991B1B]">{previewError}</p>
            <ActionButton variant="secondary" onClick={loadPreview} className="gap-1.5">
              <RefreshCw className="w-3.5 h-3.5" />
              {t("followUp.retry")}
            </ActionButton>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className={FORM_LABEL_CLASS}>{t("followUp.subject")}</Label>
              <Input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className={FORM_FIELD_CLASS}
                data-testid="follow-up-subject"
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label className={FORM_LABEL_CLASS}>{t("followUp.preheader")}</Label>
              <Input
                value={preheader}
                onChange={(e) => setPreheader(e.target.value)}
                className={FORM_FIELD_CLASS}
                data-testid="follow-up-preheader"
              />
              <p className="text-xs text-[#6B7280]">{t("followUp.preheaderHint")}</p>
            </div>
            <div className="space-y-2">
              <Label className={FORM_LABEL_CLASS}>{t("followUp.message")}</Label>
              <Textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={10}
                className={FORM_LARGE_TEXTAREA_CLASS}
                data-testid="follow-up-message"
              />
            </div>
            <p className="text-xs text-[#6B7280]">{t("followUp.hint")}</p>
          </div>
        )}

        <WorkflowModalFooter>
          <ActionButton variant="secondary" onClick={() => onOpenChange(false)} disabled={submitting}>
            {t("actions.close")}
          </ActionButton>
          <ActionButton
            variant="primary"
            onClick={handleCopy}
            disabled={loading || submitting || Boolean(previewError) || !message.trim()}
            className="gap-1.5"
            data-testid="follow-up-copy-btn"
          >
            {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Copy className="w-3.5 h-3.5" />}
            {t("followUp.copy")}
          </ActionButton>
        </WorkflowModalFooter>
      </DialogContent>
    </Dialog>
  );
}
