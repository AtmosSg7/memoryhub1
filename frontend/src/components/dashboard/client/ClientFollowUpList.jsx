import { Send } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useDashboardLang } from "@/hooks/useDashboardLang";
import EmptyState from "@/components/dashboard/EmptyState";
import { InlineLoader, PageError } from "@/components/dashboard/PageFeedback";
import { formatEventTime } from "@/utils/eventDisplay";
import { commercialDocumentsPath } from "@/utils/commercialDocumentsPath";

export default function ClientFollowUpList({ items, loading, error, emptyLabel, limit, testIdPrefix = "client-follow-ups" }) {
  const { t, lang } = useDashboardLang();
  const navigate = useNavigate();
  const visible = limit ? items.slice(0, limit) : items;

  if (loading) {
    return <InlineLoader label={t("activity.loading")} testId={`${testIdPrefix}-loading`} className="py-6 justify-start" />;
  }

  if (error) {
    return <PageError message={error} testId={`${testIdPrefix}-error`} />;
  }

  if (!visible.length) {
    return (
      <EmptyState
        compact
        inline
        icon={Send}
        title={emptyLabel}
        testId={`${testIdPrefix}-empty`}
      />
    );
  }

  return (
    <ul className="space-y-2" data-testid={testIdPrefix}>
      {visible.map((item) => {
        const route = commercialDocumentsPath({
          kind: item.entityType === "invoice" ? "invoice" : "quote",
          open: item.entityId,
        });

        return (
          <li key={item.id}>
            <button
              type="button"
              onClick={() => navigate(route)}
              className="w-full text-left rounded-lg border border-[#FDE68A] bg-[#FFFBEB] px-3 py-2.5 hover:border-[#F59E0B]/40 transition-colors"
              data-testid={`${testIdPrefix}-item-${item.id}`}
            >
              <div className="flex items-center gap-2 mb-0.5">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-dash-surface border border-[#FDE68A] text-[#92400E]">
                  <Send className="w-3 h-3" />
                  {t("followUpHistory.badge")}
                </span>
                <span className="text-[11px] font-medium text-[#92400E]">{item.documentNumber}</span>
                <span className="ml-auto text-[11px] text-dash-text-subtle tabular-nums">
                  {formatEventTime(item.recordedAt, lang)}
                </span>
              </div>
              {item.subject ? (
                <p className="text-xs font-medium text-dash-text truncate">{item.subject}</p>
              ) : null}
              {item.excerpt ? (
                <p className="text-xs text-dash-text-muted mt-0.5 truncate">{item.excerpt}</p>
              ) : null}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
