import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { toast } from "sonner";
import { useDashboardLang } from "@/hooks/useDashboardLang";
import { submitBetaFeedback } from "@/lib/betaFeedbackApi";
import { ActionButton } from "@/components/dashboard/ActionButton";
import { HoneypotField, useFormAbuseGuard } from "@/components/auth/FormAbuseFields";
import {
  DETAIL_MODAL_OVERLAY_CLASS,
  FORM_TEXTAREA_CLASS,
} from "@/components/dashboard/detailModalLayout";

export default function BetaFeedbackDialog({ open, onOpenChange }) {
  const { t } = useDashboardLang();
  const location = useLocation();
  const [intent, setIntent] = useState("");
  const [blocker, setBlocker] = useState("");
  const [suggestion, setSuggestion] = useState("");
  const [honeypot, setHoneypot] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { formStartedAt } = useFormAbuseGuard();

  useEffect(() => {
    if (!open) {
      setIntent("");
      setBlocker("");
      setSuggestion("");
      setHoneypot("");
      setSubmitting(false);
    }
  }, [open]);

  if (!open) return null;

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (submitting) return;
    if (!intent.trim()) {
      toast.error(t("betaFeedback.intentRequired"));
      return;
    }
    setSubmitting(true);
    try {
      await submitBetaFeedback({
        intent: intent.trim(),
        blocker: blocker.trim(),
        suggestion: suggestion.trim(),
        page: location.pathname,
        website: honeypot,
        formStartedAt,
      });
      toast.success(t("betaFeedback.success"));
      onOpenChange?.(false);
    } catch (err) {
      toast.error(err?.message || t("betaFeedback.error"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className={`fixed inset-0 flex items-end sm:items-center justify-center p-3 sm:p-6 ${DETAIL_MODAL_OVERLAY_CLASS}`}
      data-testid="beta-feedback-dialog"
      role="dialog"
      aria-modal="true"
    >
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md rounded-[18px] bg-[var(--dash-modal-bg,#FFFFFF)] border border-dash-border shadow-[var(--dash-modal-shadow)] overflow-hidden text-dash-text backdrop-blur-none"
      >
        <div className="px-5 pt-5 pb-3 border-b border-dash-border-soft">
          <h2 className="font-cabinet text-lg font-bold text-dash-text">{t("betaFeedback.title")}</h2>
          <p className="text-xs text-dash-text-muted mt-1">{t("betaFeedback.subtitle")}</p>
        </div>
        <div className="relative px-5 py-4 space-y-3">
          <HoneypotField value={honeypot} onChange={(e) => setHoneypot(e.target.value)} />
          <label className="block space-y-1">
            <span className="text-xs font-medium text-dash-text-muted">{t("betaFeedback.intent")}</span>
            <textarea
              value={intent}
              onChange={(e) => setIntent(e.target.value)}
              rows={2}
              maxLength={500}
              className={`${FORM_TEXTAREA_CLASS} min-h-0`}
              data-testid="beta-feedback-intent"
              required
            />
          </label>
          <label className="block space-y-1">
            <span className="text-xs font-medium text-dash-text-muted">{t("betaFeedback.blocker")}</span>
            <textarea
              value={blocker}
              onChange={(e) => setBlocker(e.target.value)}
              rows={2}
              maxLength={500}
              className={`${FORM_TEXTAREA_CLASS} min-h-0`}
              data-testid="beta-feedback-blocker"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-xs font-medium text-dash-text-muted">{t("betaFeedback.suggestion")}</span>
            <textarea
              value={suggestion}
              onChange={(e) => setSuggestion(e.target.value)}
              rows={2}
              maxLength={1000}
              className={`${FORM_TEXTAREA_CLASS} min-h-0`}
              data-testid="beta-feedback-suggestion"
            />
          </label>
          <p className="text-[11px] text-dash-text-subtle">{t("betaFeedback.privacy")}</p>
        </div>
        <div className="px-5 py-4 border-t border-dash-border-soft flex justify-end gap-2">
          <button
            type="button"
            onClick={() => onOpenChange?.(false)}
            className="text-sm text-dash-text-muted hover:text-dash-text px-3 py-2"
            disabled={submitting}
          >
            {t("betaFeedback.cancel")}
          </button>
          <ActionButton type="submit" variant="primary" disabled={submitting} data-testid="beta-feedback-submit">
            {submitting ? t("betaFeedback.sending") : t("betaFeedback.send")}
          </ActionButton>
        </div>
      </form>
    </div>
  );
}
