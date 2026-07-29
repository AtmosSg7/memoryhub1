import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { toast } from "sonner";
import { useDashboardLang } from "@/hooks/useDashboardLang";
import { submitBetaFeedback } from "@/lib/betaFeedbackApi";
import { ActionButton } from "@/components/dashboard/ActionButton";

export default function BetaFeedbackDialog({ open, onOpenChange }) {
  const { t } = useDashboardLang();
  const location = useLocation();
  const [intent, setIntent] = useState("");
  const [blocker, setBlocker] = useState("");
  const [suggestion, setSuggestion] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) {
      setIntent("");
      setBlocker("");
      setSuggestion("");
      setSubmitting(false);
    }
  }, [open]);

  if (!open) return null;

  const handleSubmit = async (event) => {
    event.preventDefault();
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
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-[#0A2540]/55 p-3 sm:p-6"
      data-testid="beta-feedback-dialog"
      role="dialog"
      aria-modal="true"
    >
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md rounded-2xl bg-white border border-[#E5E7EB] shadow-xl overflow-hidden"
      >
        <div className="px-5 pt-5 pb-3 border-b border-[#F3F4F6]">
          <h2 className="font-cabinet text-lg font-bold text-[#111827]">{t("betaFeedback.title")}</h2>
          <p className="text-xs text-[#6B7280] mt-1">{t("betaFeedback.subtitle")}</p>
        </div>
        <div className="px-5 py-4 space-y-3">
          <label className="block space-y-1">
            <span className="text-xs font-medium text-[#374151]">{t("betaFeedback.intent")}</span>
            <textarea
              value={intent}
              onChange={(e) => setIntent(e.target.value)}
              rows={2}
              maxLength={500}
              className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0A2540]/20"
              data-testid="beta-feedback-intent"
              required
            />
          </label>
          <label className="block space-y-1">
            <span className="text-xs font-medium text-[#374151]">{t("betaFeedback.blocker")}</span>
            <textarea
              value={blocker}
              onChange={(e) => setBlocker(e.target.value)}
              rows={2}
              maxLength={500}
              className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0A2540]/20"
              data-testid="beta-feedback-blocker"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-xs font-medium text-[#374151]">{t("betaFeedback.suggestion")}</span>
            <textarea
              value={suggestion}
              onChange={(e) => setSuggestion(e.target.value)}
              rows={2}
              maxLength={1000}
              className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0A2540]/20"
              data-testid="beta-feedback-suggestion"
            />
          </label>
          <p className="text-[11px] text-[#9CA3AF]">{t("betaFeedback.privacy")}</p>
        </div>
        <div className="px-5 py-4 border-t border-[#F3F4F6] flex justify-end gap-2">
          <button
            type="button"
            onClick={() => onOpenChange?.(false)}
            className="text-sm text-[#6B7280] hover:text-[#111827] px-3 py-2"
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
