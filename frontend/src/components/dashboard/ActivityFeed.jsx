import { Clock3 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useDashboardLang } from "@/hooks/useDashboardLang";
import { useAddNote } from "@/context/AddNoteContext";
import { useRecentActivity } from "@/hooks/useRecentActivity";
import EmptyState from "@/components/dashboard/EmptyState";
import CommercialTimeline from "@/components/dashboard/CommercialTimeline";

export default function ActivityFeed({
  limit = 10,
  showViewAll = true,
  showHeader = true,
  showEmptyState = false,
  compact = false,
  muted = false,
  viewAllPath = "/dashboard/communications",
}) {
  const { t } = useDashboardLang();
  const navigate = useNavigate();
  const { openAddNote } = useAddNote();
  const { events, loading, error } = useRecentActivity(limit);

  const showEmpty = showEmptyState && !loading && !error && events.length === 0;

  return (
    <section
      data-testid="activity-feed-section"
      className={[
        "rounded-xl",
        muted
          ? "bg-dash-surface-muted border border-dash-border-soft p-3"
          : `bg-dash-surface border border-dash-border ${compact ? "p-4" : "p-5 md:p-6"}`,
      ].join(" ")}
    >
      {showHeader && (
        <div className={`flex items-start justify-between ${compact ? "mb-3" : "mb-5"}`}>
          <div>
            <h3
              className={[
                "font-cabinet font-bold tracking-tight",
                muted ? "text-xs text-dash-text-muted" : compact ? "text-sm text-dash-text" : "text-lg text-dash-text",
              ].join(" ")}
            >
              {t("activity.title")}
            </h3>
            {!compact && !muted && (
              <p className="text-xs text-dash-text-muted mt-0.5">{t("activity.subtitle")}</p>
            )}
          </div>
          {showViewAll && (
            <button
              type="button"
              data-testid="activity-feed-view-all"
              onClick={() => navigate(viewAllPath)}
              className={
                muted
                  ? "text-[10px] font-medium text-dash-text-subtle hover:text-dash-text-muted"
                  : "text-xs font-medium text-dash-primary hover:text-dash-primary"
              }
            >
              {t("activity.viewAll")}
            </button>
          )}
        </div>
      )}

      {showEmpty ? (
        <EmptyState
          icon={Clock3}
          title={t("empty.noActivity.title")}
          description={t("empty.noActivity.desc")}
          cta={t("empty.noActivity.cta")}
          onCta={openAddNote}
          testId="empty-activity"
          compact
          inline
        />
      ) : (
        <CommercialTimeline
          events={events}
          loading={loading}
          error={error}
          compact={compact}
          muted={muted}
          emptyLabel={!showEmptyState ? t("empty.noActivity.desc") : undefined}
          testIdPrefix="activity-feed"
        />
      )}
    </section>
  );
}
