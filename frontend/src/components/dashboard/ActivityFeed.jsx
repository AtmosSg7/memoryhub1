import { Clock3 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useDashboardLang } from "@/hooks/useDashboardLang";
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
}) {
  const { t } = useDashboardLang();
  const navigate = useNavigate();
  const { events, loading, error } = useRecentActivity(limit);

  const showEmpty = showEmptyState && !loading && !error && events.length === 0;

  return (
    <>
      <section
        data-testid="activity-feed-section"
        className={[
          "rounded-xl",
          muted
            ? "bg-[#FAFAFA] border border-[#F3F4F6] p-3"
            : `bg-white border border-[#E5E7EB] ${compact ? "p-4" : "p-5 md:p-6"}`,
        ].join(" ")}
      >
        {showHeader && (
          <div className={`flex items-start justify-between ${compact ? "mb-3" : "mb-5"}`}>
            <div>
              <h3
                className={[
                  "font-cabinet font-bold tracking-tight",
                  muted ? "text-xs text-[#6B7280]" : compact ? "text-sm text-[#111827]" : "text-lg text-[#111827]",
                ].join(" ")}
              >
                {t("activity.title")}
              </h3>
              {!compact && !muted && (
                <p className="text-xs text-[#6B7280] mt-0.5">{t("activity.subtitle")}</p>
              )}
            </div>
            {showViewAll && (
              <button
                type="button"
                data-testid="activity-feed-view-all"
                onClick={() => navigate("/dashboard/communications")}
                className={
                  muted
                    ? "text-[10px] font-medium text-[#9CA3AF] hover:text-[#6B7280]"
                    : "text-xs font-medium text-[#0A2540] hover:text-[#173A5E]"
                }
              >
                {t("activity.viewAll")}
              </button>
            )}
          </div>
        )}

        <CommercialTimeline
          events={events}
          loading={loading}
          error={error}
          compact={compact}
          muted={muted}
          emptyLabel={!showEmptyState ? t("empty.noActivity.desc") : undefined}
          testIdPrefix="activity-feed"
        />
      </section>

      {showEmpty && (
        <EmptyState
          icon={Clock3}
          title={t("empty.noActivity.title")}
          description={t("empty.noActivity.desc")}
          cta={t("empty.noActivity.cta")}
          testId="empty-activity"
          compact
        />
      )}
    </>
  );
}
