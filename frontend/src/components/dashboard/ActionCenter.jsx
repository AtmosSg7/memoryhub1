import { useNavigate } from "react-router-dom";
import { useDashboardLang } from "@/hooks/useDashboardLang";
import { PageError, InlineLoader } from "@/components/dashboard/PageFeedback";
import EmptyState from "@/components/dashboard/EmptyState";
import { ListChecks } from "lucide-react";

const PRIORITY_CLASS = {
  critical: "dash-badge dash-badge-danger",
  high: "dash-badge dash-badge-warning",
  medium: "dash-badge dash-badge-info",
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

export default function ActionCenter({
  actions = [],
  loading,
  error,
  limit = 12,
  compact = false,
  testId = "action-center",
}) {
  const { t, lang } = useDashboardLang();
  const navigate = useNavigate();
  const items = (actions || []).slice(0, limit);

  if (loading) {
    return (
      <InlineLoader
        label={t("intelligence.loading")}
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
        title={t("intelligence.actionsEmptyTitle")}
        description={t("intelligence.actionsEmpty")}
        testId={`${testId}-empty`}
        compact
        inline
      />
    );
  }

  return (
    <ul
      className={[
        "divide-y divide-dash-border-soft overflow-hidden",
        compact
          ? "rounded-lg border border-dash-border-soft bg-dash-surface-muted"
          : "rounded-xl border border-dash-border bg-dash-surface",
      ].join(" ")}
      data-testid={testId}
    >
      {items.map((action) => (
        <li key={action.id}>
          <button
            type="button"
            onClick={() => action.link && navigate(action.link)}
            className={[
              "w-full text-left hover:bg-dash-surface transition-colors",
              compact ? "px-3 py-2.5" : "px-4 py-3",
            ].join(" ")}
            data-testid={`action-item-${action.ruleId}`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p
                  className={[
                    "font-medium text-dash-text truncate",
                    compact ? "text-[13px]" : "text-sm",
                  ].join(" ")}
                >
                  {action.title}
                </p>
                {!compact || action.priority === "critical" || action.priority === "high" ? (
                  <p className="text-xs text-dash-text-muted mt-0.5 line-clamp-1">{action.reason}</p>
                ) : null}
              </div>
              <div className="shrink-0 text-right space-y-1">
                <span
                  className={[
                    "uppercase tracking-wide",
                    PRIORITY_CLASS[action.priority] || PRIORITY_CLASS.medium,
                  ].join(" ")}
                >
                  {t(`intelligence.priority.${action.priority}`)}
                </span>
                {!compact && action.date ? (
                  <p className="text-[10px] text-dash-text-subtle">{formatDate(action.date, lang)}</p>
                ) : null}
              </div>
            </div>
          </button>
        </li>
      ))}
    </ul>
  );
}
