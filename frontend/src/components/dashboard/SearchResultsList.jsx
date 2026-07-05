import SearchResultItem from "@/components/dashboard/SearchResultItem";
import { useDashboardLang } from "@/hooks/useDashboardLang";

const GROUP_ORDER = ["clients", "quotes", "invoices", "notes", "documents"];

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

  if (loading) {
    return (
      <div
        data-testid={`${testId}-loading`}
        className={compact ? "px-3 py-4 text-center text-[12px] text-[#6B7280]" : "py-10 text-center text-sm text-[#6B7280]"}
      >
        {t("search.loading")}
      </div>
    );
  }

  if (error) {
    return (
      <div
        data-testid={`${testId}-error`}
        className={compact ? "px-3 py-4 text-center text-[12px] text-[#991B1B]" : "py-10 text-center text-sm text-[#991B1B]"}
      >
        {error}
      </div>
    );
  }

  if (!groups || total === 0) {
    return (
      <div
        data-testid={`${testId}-empty`}
        className={compact ? "px-3 py-4 text-center text-[12px] text-[#6B7280]" : "py-10 text-center"}
      >
        <p className={compact ? "" : "text-sm text-[#6B7280]"}>
          {t("search.noResults").replace("{query}", query || "")}
        </p>
      </div>
    );
  }

  return (
    <div data-testid={testId} className={compact ? "" : "space-y-5"}>
      {showSummary && !compact && (
        <p className="text-[13px] text-[#6B7280]">
          {t("search.resultsCount")
            .replace("{count}", String(total))
            .replace("{query}", query || "")}
        </p>
      )}

      {GROUP_ORDER.map((groupKey) => {
        const group = groups[groupKey];
        if (!group?.items?.length) return null;

        return (
          <section key={groupKey} data-testid={`${testId}-group-${groupKey}`}>
            <div
              className={[
                "flex items-center justify-between",
                compact ? "px-3 py-2 bg-[#F9FAFB] border-b border-[#F3F4F6]" : "mb-2",
              ].join(" ")}
            >
              <h4
                className={[
                  "font-semibold uppercase tracking-widest text-[#6B7280]",
                  compact ? "text-[10px]" : "text-[11px]",
                ].join(" ")}
              >
                {t(`search.groups.${groupKey}`)}
              </h4>
              {group.total > group.items.length && (
                <span className="text-[10px] text-[#9CA3AF]">
                  {t("search.moreResults").replace("{count}", String(group.total - group.items.length))}
                </span>
              )}
            </div>
            <div className={compact ? "divide-y divide-[#F3F4F6]" : "bg-white border border-[#E5E7EB] rounded-xl overflow-hidden divide-y divide-[#F3F4F6]"}>
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
