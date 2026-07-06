import { useEffect, useState } from "react";
import { Copy, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useDashboardLang } from "@/hooks/useDashboardLang";
import { useFollowUpContext } from "@/context/FollowUpContext";
import { previewFollowUp, recordFollowUp } from "@/lib/followUpsApi";
import { ActionButton } from "@/components/dashboard/ActionButton";
import {
  DETAIL_MODAL_CONTENT_CLASS,
  DETAIL_MODAL_OVERLAY_CLASS,
  FORM_FIELD_CLASS,
  FORM_LABEL_CLASS,
} from "@/components/dashboard/detailModalLayout";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export default function FollowUpModal({ entityType, entityId, open, onOpenChange, onRecorded }) {
  const { t, lang } = useDashboardLang();
  const { notifyFollowUpsChanged } = useFollowUpContext();
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [clientName, setClientName] = useState("");

  useEffect(() => {
    if (!open || !entityType || !entityId) return;
    let cancelled = false;
    setLoading(true);
    previewFollowUp({ entityType, entityId, lang })
      .then((data) => {
        if (cancelled) return;
        setSubject(data.subject || "");
        setMessage(data.message || "");
        setClientName(data.clientName || "");
      })
      .catch((err) => {
        if (!cancelled) {
          toast.error(err.message || t("followUp.error"));
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

  const handleCopy = async () => {
    if (!message.trim()) return;
    setSubmitting(true);
    try {
      const fullText = subject.trim() ? `Subject: ${subject.trim()}\n\n${message.trim()}` : message.trim();
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
      toast.error(err.message || t("followUp.error"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        overlayClassName={DETAIL_MODAL_OVERLAY_CLASS}
        className={DETAIL_MODAL_CONTENT_CLASS}
        data-testid="follow-up-modal"
      >
        <DialogHeader className="space-y-1 pb-1">
          <DialogTitle className="font-cabinet text-xl font-bold tracking-[-0.02em] text-[#111827]">
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
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className={FORM_LABEL_CLASS}>{t("followUp.subject")}</Label>
              <Input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className={FORM_FIELD_CLASS}
                data-testid="follow-up-subject"
              />
            </div>
            <div className="space-y-2">
              <Label className={FORM_LABEL_CLASS}>{t("followUp.message")}</Label>
              <Textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={10}
                className={`${FORM_FIELD_CLASS} min-h-[220px] resize-y`}
                data-testid="follow-up-message"
              />
            </div>
            <p className="text-xs text-[#6B7280]">{t("followUp.hint")}</p>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-2">
          <ActionButton variant="secondary" onClick={() => onOpenChange(false)} disabled={submitting}>
            {t("actions.close")}
          </ActionButton>
          <ActionButton
            variant="primary"
            onClick={handleCopy}
            disabled={loading || submitting || !message.trim()}
            className="gap-1.5"
            data-testid="follow-up-copy-btn"
          >
            {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Copy className="w-3.5 h-3.5" />}
            {t("followUp.copy")}
          </ActionButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
