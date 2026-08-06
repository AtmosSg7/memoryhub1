import { useCallback, useEffect, useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useDashboardLang } from "@/hooks/useDashboardLang";
import { ActionButton } from "@/components/dashboard/ActionButton";
import { invalidateActionsPendingCount } from "@/hooks/useActionsCountInvalidate";
import {
  acceptIntelligenceSuggestion,
  analyzeCommunication,
  getCommunicationIntelligence,
  rejectIntelligenceSuggestion,
} from "@/lib/communicationIntelligenceApi";

const URGENCY_CLASS = {
  urgent: "dash-badge dash-badge-danger",
  high: "dash-badge dash-badge-warning",
  normal: "dash-badge dash-badge-info",
  low: "dash-badge dash-badge-neutral",
};

/**
 * Minimal AI suggestion panel for a communication (Gmail first).
 * Suggests only — never acts alone.
 */
export default function CommunicationIntelligenceCard({
  communicationId,
  autoLoad = true,
  compact = false,
  onActionCreated,
  testId = "comm-intelligence",
}) {
  const { t } = useDashboardLang();
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(Boolean(autoLoad));
  const [busy, setBusy] = useState(null);
  const [hidden, setHidden] = useState(false);

  const load = useCallback(async () => {
    if (!communicationId) return;
    setLoading(true);
    try {
      const data = await getCommunicationIntelligence(communicationId);
      setAnalysis(data);
    } catch {
      setAnalysis(null);
    } finally {
      setLoading(false);
    }
  }, [communicationId]);

  useEffect(() => {
    if (autoLoad) load();
  }, [autoLoad, load]);

  const runAnalyze = async () => {
    if (busy || !communicationId) return;
    setBusy("analyze");
    try {
      const data = await analyzeCommunication(communicationId);
      setAnalysis(data);
      if (data?.status === "skipped") {
        toast.message(t("commIntelligence.skipped"));
      } else if (data?.status === "error") {
        toast.error(t("commIntelligence.error"));
      } else {
        toast.success(t("commIntelligence.analyzed"));
      }
    } catch (err) {
      const msg = err?.message || "";
      if (msg.toLowerCase().includes("disabled")) {
        setHidden(true);
      } else {
        toast.error(msg || t("commIntelligence.error"));
      }
    } finally {
      setBusy(null);
    }
  };

  const runAccept = async () => {
    if (busy || !communicationId) return;
    setBusy("accept");
    try {
      const data = await acceptIntelligenceSuggestion(communicationId);
      setAnalysis(data.analysis);
      toast.success(t("commIntelligence.accepted"));
      invalidateActionsPendingCount();
      onActionCreated?.(data.action);
    } catch (err) {
      toast.error(err?.message || t("commIntelligence.error"));
    } finally {
      setBusy(null);
    }
  };

  const runReject = async () => {
    if (busy || !communicationId) return;
    setBusy("reject");
    try {
      const data = await rejectIntelligenceSuggestion(communicationId);
      setAnalysis(data);
      toast.success(t("commIntelligence.rejected"));
    } catch (err) {
      toast.error(err?.message || t("commIntelligence.error"));
    } finally {
      setBusy(null);
    }
  };

  if (hidden) return null;

  if (loading) {
    return (
      <div
        className="flex items-center gap-2 text-xs text-dash-text-muted py-1"
        data-testid={`${testId}-loading`}
      >
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
        {t("commIntelligence.loading")}
      </div>
    );
  }

  const ready = analysis?.status === "ready";
  const pendingSuggestion = ready && analysis?.suggestionStatus === "pending";
  const showPanel = ready || analysis?.status === "error";

  if (!showPanel) {
    return (
      <div className="pt-1" data-testid={`${testId}-idle`}>
        <ActionButton
          variant="quick"
          disabled={Boolean(busy)}
          onClick={runAnalyze}
          className="gap-1"
          data-testid={`${testId}-analyze`}
        >
          {busy === "analyze" ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Sparkles className="w-3.5 h-3.5" />
          )}
          {t("commIntelligence.analyze")}
        </ActionButton>
      </div>
    );
  }

  if (analysis?.status === "error") {
    return (
      <div
        className="rounded-lg border border-dash-border-soft bg-dash-surface-muted px-3 py-2 space-y-2"
        data-testid={`${testId}-error`}
      >
        <p className="text-xs text-dash-text-muted">{t("commIntelligence.errorHint")}</p>
        <ActionButton
          variant="quick"
          disabled={Boolean(busy)}
          onClick={runAnalyze}
          data-testid={`${testId}-retry`}
        >
          {t("commIntelligence.retry")}
        </ActionButton>
      </div>
    );
  }

  if (analysis?.suggestionStatus === "rejected" || analysis?.suggestionStatus === "accepted") {
    return (
      <div
        className={[
          "rounded-lg border border-dash-border-soft px-3 py-2 space-y-1",
          compact ? "bg-dash-surface-muted/50" : "bg-dash-surface-muted",
        ].join(" ")}
        data-testid={`${testId}-done`}
      >
        <p className="text-xs text-dash-text-muted line-clamp-2">{analysis.summary}</p>
        <p className="text-[11px] text-dash-text-subtle">
          {analysis.suggestionStatus === "accepted"
            ? t("commIntelligence.statusAccepted")
            : t("commIntelligence.statusRejected")}
        </p>
      </div>
    );
  }

  return (
    <div
      className={[
        "rounded-lg border border-[color:var(--dash-info-border)] bg-dash-accent-soft px-3 py-2.5 space-y-2",
      ].join(" ")}
      data-testid={testId}
    >
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-dash-accent">
          <Sparkles className="w-3 h-3" />
          {t("commIntelligence.badge")}
        </span>
        {analysis.urgency ? (
          <span
            className={[
              "uppercase tracking-wide",
              URGENCY_CLASS[analysis.urgency] || URGENCY_CLASS.normal,
            ].join(" ")}
          >
            {t(`commIntelligence.urgency.${analysis.urgency}`)}
          </span>
        ) : null}
      </div>
      {analysis.summary ? (
        <p className="text-sm text-dash-text leading-snug">{analysis.summary}</p>
      ) : null}
      {analysis.intent ? (
        <p className="text-xs text-dash-text-muted">
          <span className="text-dash-text-subtle">{t("commIntelligence.intentLabel")}: </span>
          {t(`commIntelligence.intent.${analysis.intent}`)}
        </p>
      ) : null}
      {analysis.suggestedActionTitle ? (
        <p className="text-xs font-medium text-dash-text">
          {t("commIntelligence.suggestedAction")}: {analysis.suggestedActionTitle}
        </p>
      ) : null}
      {pendingSuggestion ? (
        <div className="flex flex-wrap gap-2 pt-0.5">
          <ActionButton
            variant="primary"
            className="h-9 min-h-9"
            disabled={Boolean(busy)}
            onClick={runAccept}
            data-testid={`${testId}-accept`}
          >
            {busy === "accept" ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              t("commIntelligence.accept")
            )}
          </ActionButton>
          <ActionButton
            variant="secondary"
            className="h-9 min-h-9"
            disabled={Boolean(busy)}
            onClick={runReject}
            data-testid={`${testId}-reject`}
          >
            {t("commIntelligence.reject")}
          </ActionButton>
        </div>
      ) : null}
    </div>
  );
}
