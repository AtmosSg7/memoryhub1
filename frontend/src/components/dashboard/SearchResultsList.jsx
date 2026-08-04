import { useNavigate } from "react-router-dom";
import SearchResultItem from "@/components/dashboard/SearchResultItem";
import { useDashboardLang } from "@/hooks/useDashboardLang";
import { translateApiError } from "@/utils/apiErrors";
import { InlineLoader } from "@/components/dashboard/PageFeedback";
import { ActionButton } from "@/components/dashboard/ActionButton";

const GROUP_ORDER = ["clients", "emails", "quotes", "invoices", "notes", "documents"];

const GROUP_LIST_PATHS = {
  clients: "/dashboard/clients",
  emails: "/dashboard/communications?category=email",
  quotes: "/dashboard/documents?kind=quote",
  invoices: "/dashboard/documents?kind=invoice",
  notes: "/dashboard/notes",
  documents: "/dashboard/files",
};

export default function SearchResultsList({
  groups,
  total,
  query,
  loading,
  error,
  onSelect,
  compact = false,
  showSummary = true,
  testId = "search-results-list",
}) {
  const { t } = useDashboardLang();
  const navigate = useNavigate();

  if (loading) {
    return (
      <InlineLoader
        label={t("search.loading")}
        testId={`${testId}-loading`}
        className={compact ? "py-4" : "py-10"}
      />
    );
  }

  if (error) {
    const message = translateApiError(error, t);
    return (
      <div
        data-testid={`${testId}-error`}
        className={compact ? "px-3 py-3" : "py-6"}
        role="alert"
      >
        <div
          className={[
            "rounded-xl border border-[#FECACA] bg-[#FEF2F2] text-[#991B1B]",
            compact ? "px-3 py-2.5 text-[12px]" : "px-4 py-3 text-sm",
          ].join(" ")}
        >
          {message}
        </div>
      </div>
    );
  }

  if (!groups || total === 0) {
    return (
      <div
        data-testid={`${testId}-empty`}
        className={compact ? "px-3 py-4 text-center" : "py-10 text-center max-w-sm mx-auto"}
      >
        <p className={compact ? "text-[12px] font-medium text-dash-text-muted" : "text-sm font-medium text-dash-text-muted"}>
          {t("search.noResults").replace("{query}", query || "")}
        </p>
        <p className={compact ? "text-[11px] text-dash-text-muted mt-1" : "text-[13px] text-dash-text-muted mt-1.5 leading-relaxed"}>
          {t("search.noResultsHint")}
        </p>
      </div>
    );
  }

  return (
    <div data-testid={testId} className={compact ? "" : "space-y-5"}>
      {showSummary && !compact && (
        <p className="text-[13px] text-dash-text-muted">
          {t("search.resultsCount")
            .replace("{count}", String(total))
            .replace("{query}", query || "")}
        </p>
      )}

      {GROUP_ORDER.map((groupKey) => {
        const group = groups[groupKey];
        if (!group?.items?.length) return null;
        const listPath = GROUP_LIST_PATHS[groupKey];
        const hasMore = group.total > group.items.length;

        return (
          <section key={groupKey} data-testid={`${testId}-group-${groupKey}`}>
            <div
              className={[
                "flex items-center justify-between gap-2",
                compact ? "px-3 py-2 bg-dash-bg border-b border-dash-border-soft" : "mb-2",
              ].join(" ")}
            >
              <h4
                className={[
                  "font-semibold uppercase tracking-widest text-dash-text-muted",
                  compact ? "text-[10px]" : "text-[11px]",
                ].join(" ")}
              >
                {t(`search.groups.${groupKey}`)}
              </h4>
              {hasMore && listPath ? (
                <ActionButton
                  variant="ghost"
                  className="h-auto py-0 px-1 text-[10px] font-medium text-dash-primary hover:underline"
                  onClick={() => navigate(listPath)}
                  data-testid={`${testId}-group-${groupKey}-view-all`}
                >
                  {t("search.showAllInGroup").replace("{count}", String(group.total))}
                </ActionButton>
              ) : hasMore ? (
                <span className="text-[10px] text-dash-text-subtle">
                  {t("search.moreResults").replace("{count}", String(group.total - group.items.length))}
                </span>
              ) : null}
            </div>
            <div className={compact ? "divide-y divide-dash-border-soft" : "bg-dash-surface border border-dash-border rounded-xl overflow-hidden divide-y divide-dash-border-soft"}>
              {group.items.map((item) => (
                <SearchResultItem
                  key={`${item.type}-${item.id}`}
                  item={item}
                  onSelect={onSelect}
                  compact={compact}
                  testId={`${testId}-item-${item.type}-${item.id}`}
                />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
