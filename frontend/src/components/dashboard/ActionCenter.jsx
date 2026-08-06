import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check, Clock, EyeOff, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { useDashboardLang } from "@/hooks/useDashboardLang";
import { PageError, InlineLoader } from "@/components/dashboard/PageFeedback";
import EmptyState from "@/components/dashboard/EmptyState";
import ActionPostponeDialog from "@/components/dashboard/ActionPostponeDialog";
import { ListChecks } from "lucide-react";
import { completeAction, dismissAction, snoozeAction } from "@/lib/actionsApi";
import { formatPostponedUntil } from "@/utils/actionSnoozePresets";

const PRIORITY_CLASS = {
  critical: "dash-badge dash-badge-danger",
  urgent: "dash-badge dash-badge-danger",
  high: "dash-badge dash-badge-warning",
  medium: "dash-badge dash-badge-info",
  normal: "dash-badge dash-badge-info",
  low: "dash-badge dash-badge-neutral",
};

function formatDate(value, lang) {
  if (!value) return "";
  try {
    return new Intl.DateTimeFormat(lang === "en" ? "en-GB" : "fr-FR", {
      dateStyle: "medium",
    }).format(new Date(value));
  } catch {
    return "";
  }
}

function priorityLabel(t, action) {
  const key = action.uiPriority || action.priority || "medium";
  const translated = t(`intelligence.priority.${key}`);
  if (translated && !translated.startsWith("intelligence.")) return translated;
  return t(`dashboardV2.engine.priority.${action.priority || "normal"}`);
}

export default function ActionCenter({
  actions = [],
  loading,
  error,
  limit = 12,
  compact = false,
  testId = "action-center",
  onChanged,
  emptyTitle,
  emptyDescription,
}) {
  const { t, lang } = useDashboardLang();
  const navigate = useNavigate();
  const [busyId, setBusyId] = useState(null);
  const [postponeActionId, setPostponeActionId] = useState(null);
  const items = (actions || []).slice(0, limit);

  const runMutation = async (actionId, mutator, successKey) => {
    if (busyId) return;
    setBusyId(actionId);
    try {
      await mutator(actionId);
      toast.success(t(successKey));
      onChanged?.();
    } catch (err) {
      toast.error(err?.message || t("dashboardV2.today.actionError"));
    } finally {
      setBusyId(null);
    }
  };

  const handlePostpone = async (until) => {
    if (!postponeActionId || busyId) return;
    const actionId = postponeActionId;
    setBusyId(actionId);
    try {
      await snoozeAction(actionId, until);
      const dateLabel = formatPostponedUntil(until, lang) || until;
      toast.success(
        t("dashboardV2.engine.toastPostponed").replace("{date}", dateLabel)
      );
      setPostponeActionId(null);
      onChanged?.();
    } catch (err) {
      toast.error(err?.message || t("dashboardV2.today.actionError"));
    } finally {
      setBusyId(null);
    }
  };

  if (loading) {
    return (
      <InlineLoader
        label={t("dashboardV2.today.loading")}
        className={compact ? "py-4" : "py-6"}
        testId={`${testId}-loading`}
      />
    );
  }
  if (error) {
    return <PageError message={error} testId={`${testId}-error`} />;
  }
  if (!items.length) {
    return (
      <EmptyState
        icon={ListChecks}
        title={emptyTitle || t("dashboardV2.engine.emptyTitle")}
        description={emptyDescription || t("dashboardV2.engine.emptyDescription")}
        testId={`${testId}-empty`}
        compact
        inline
      />
    );
  }

  return (
    <>
      <ul
        className={[
          "divide-y divide-dash-border-soft overflow-hidden",
          compact
            ? "rounded-lg border border-dash-border-soft bg-dash-surface-muted"
            : "rounded-xl border border-dash-border bg-dash-surface",
        ].join(" ")}
        data-testid={testId}
      >
        {items.map((action) => {
          const busy = busyId === action.id;
          const badgePriority = action.uiPriority || action.priority || "medium";
          const postponedLabel = action.snoozedUntil
            ? t("dashboardV2.engine.postponedUntil").replace(
                "{date}",
                formatPostponedUntil(action.snoozedUntil, lang) ||
                  formatDate(action.snoozedUntil, lang)
              )
            : null;
          return (
            <li key={action.id} data-testid={`action-item-${action.ruleId || action.type}`}>
              <div
                className={[
                  "w-full text-left",
                  compact ? "px-3 py-2.5" : "px-4 py-3",
                ].join(" ")}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5 mb-0.5">
                      <span
                        className={[
                          "uppercase tracking-wide",
                          PRIORITY_CLASS[badgePriority] || PRIORITY_CLASS.medium,
                        ].join(" ")}
                      >
                        {priorityLabel(t, action)}
                      </span>
                      {action.overdue ? (
                        <span className="dash-badge dash-badge-danger uppercase tracking-wide">
                          {t("dashboardV2.engine.overdue")}
                        </span>
                      ) : null}
                    </div>
                    <p
                      className={[
                        "font-medium text-dash-text",
                        compact ? "text-[13px]" : "text-sm",
                      ].join(" ")}
                    >
                      {action.title}
                    </p>
                    {action.reason || action.partyLabel ? (
                      <p className="text-xs text-dash-text-muted mt-0.5 line-clamp-2">
                        {[action.partyLabel, action.reason].filter(Boolean).join(" · ")}
                      </p>
                    ) : null}
                    {postponedLabel ? (
                      <p
                        className="text-[10px] text-dash-text-subtle mt-1"
                        data-testid={`action-postponed-${action.id}`}
                      >
                        {postponedLabel}
                      </p>
                    ) : action.date ? (
                      <p className="text-[10px] text-dash-text-subtle mt-1">
                        {formatDate(action.date, lang)}
                      </p>
                    ) : null}
                  </div>
                </div>

                <div className="mt-2.5 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={busy || !action.link}
                    onClick={() => action.link && navigate(action.link)}
                    className="inline-flex min-h-11 items-center gap-1 rounded-lg bg-[var(--dash-cta)] px-3.5 py-2 text-[13px] font-semibold text-[var(--dash-cta-text,#fff)] disabled:opacity-50 hover:opacity-95 transition-opacity sm:min-h-0 sm:px-2.5 sm:py-1.5 sm:text-[11px]"
                    data-testid={`action-primary-${action.id}`}
                  >
                    {t(action.primaryLabelKey || "dashboardV2.engine.cta.open")}
                    <ChevronRight className="w-3.5 h-3.5" strokeWidth={2} />
                  </button>
                  {action.secondaryNav?.path ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => navigate(action.secondaryNav.path)}
                      className="inline-flex min-h-11 items-center rounded-lg border border-dash-border bg-dash-surface px-3.5 py-2 text-[13px] font-medium text-dash-text hover:bg-dash-bg transition-colors sm:min-h-0 sm:px-2.5 sm:py-1.5 sm:text-[11px]"
                      data-testid={`action-secondary-${action.id}`}
                    >
                      {t(action.secondaryNav.labelKey)}
                    </button>
                  ) : null}
                  <button
                    type="button"
                    disabled={Boolean(busyId)}
                    onClick={() => setPostponeActionId(action.id)}
                    className="inline-flex min-h-11 items-center gap-1 rounded-lg px-3 py-2 text-[13px] font-medium text-dash-text-muted hover:text-dash-text hover:bg-dash-bg transition-colors disabled:opacity-50 sm:min-h-0 sm:px-2 sm:py-1.5 sm:text-[11px]"
                    data-testid={`action-postpone-${action.id}`}
                    title={t("dashboardV2.engine.postpone")}
                  >
                    <Clock className="w-3.5 h-3.5" strokeWidth={2} />
                    <span>{t("dashboardV2.engine.postpone")}</span>
                  </button>
                  <button
                    type="button"
                    disabled={Boolean(busyId)}
                    onClick={() =>
                      runMutation(action.id, completeAction, "dashboardV2.engine.toastCompleted")
                    }
                    className="inline-flex min-h-11 items-center gap-1 rounded-lg px-3 py-2 text-[13px] font-medium text-dash-text-muted hover:text-dash-text hover:bg-dash-bg transition-colors disabled:opacity-50 sm:min-h-0 sm:px-2 sm:py-1.5 sm:text-[11px]"
                    data-testid={`action-complete-${action.id}`}
                    title={t("dashboardV2.engine.complete")}
                  >
                    <Check className="w-3.5 h-3.5" strokeWidth={2} />
                    <span>{t("dashboardV2.engine.complete")}</span>
                  </button>
                  <button
                    type="button"
                    disabled={Boolean(busyId)}
                    onClick={() =>
                      runMutation(action.id, dismissAction, "dashboardV2.engine.toastDismissed")
                    }
                    className="inline-flex min-h-11 items-center gap-1 rounded-lg px-3 py-2 text-[13px] font-medium text-dash-text-muted hover:text-dash-text hover:bg-dash-bg transition-colors disabled:opacity-50 sm:min-h-0 sm:px-2 sm:py-1.5 sm:text-[11px]"
                    data-testid={`action-dismiss-${action.id}`}
                    title={t("dashboardV2.engine.dismiss")}
                  >
                    <EyeOff className="w-3.5 h-3.5" strokeWidth={2} />
                    <span>{t("dashboardV2.engine.dismiss")}</span>
                  </button>
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      <ActionPostponeDialog
        open={Boolean(postponeActionId)}
        onOpenChange={(open) => {
          if (!open && !busyId) setPostponeActionId(null);
        }}
        onSelectUntil={handlePostpone}
        busy={Boolean(busyId)}
        testId={`${testId}-postpone-dialog`}
      />
    </>
  );
}
