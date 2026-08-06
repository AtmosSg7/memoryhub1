import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Search, Clock3, X } from "lucide-react";
import { useDashboardLang } from "@/hooks/useDashboardLang";
import { usePageTitle } from "@/hooks/usePageTitle";
import { useSearch, SEARCH_MIN_CHARS } from "@/hooks/useSearch";
import { useSearchHistory } from "@/hooks/useSearchHistory";
import PageHeader from "@/components/dashboard/PageHeader";
import SearchField from "@/components/dashboard/SearchField";
import SearchResultsList from "@/components/dashboard/SearchResultsList";
import EmptyState from "@/components/dashboard/EmptyState";
import { ActionButton } from "@/components/dashboard/ActionButton";

export default function SearchPage() {
  const { t } = useDashboardLang();
  usePageTitle("page.search.title");
  const [searchParams, setSearchParams] = useSearchParams();
  const { history, addSearch, removeSearch, clearHistory } = useSearchHistory();

  const urlQuery = searchParams.get("q") || "";
  const [inputValue, setInputValue] = useState(urlQuery);

  const minChars = SEARCH_MIN_CHARS;
  const [resultLimit, setResultLimit] = useState(20);
  const { data, loading, error } = useSearch(inputValue, {
    enabled: inputValue.trim().length >= minChars,
    limit: resultLimit,
  });

  useEffect(() => {
    setInputValue(urlQuery);
    setResultLimit(20);
  }, [urlQuery]);

  const handleSubmit = (event) => {
    event.preventDefault();
    const trimmed = inputValue.trim();
    if (trimmed.length < minChars) return;
    addSearch(trimmed);
    setSearchParams({ q: trimmed });
  };

  const handleHistoryClick = (query) => {
    setInputValue(query);
    addSearch(query);
    setSearchParams({ q: query });
  };

  const trimmed = inputValue.trim();
  const showResults = trimmed.length >= minChars;

  return (
    <div className="space-y-6" data-testid="search-page">
      <PageHeader
        title={t("page.search.title")}
        subtitle={t("page.search.subtitle")}
        testId="search-header"
      />

      <div className="bg-dash-surface border border-dash-border rounded-xl p-5 md:p-6">
        <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-2">
          <SearchField
            data-testid="search-page-input"
            value={inputValue}
            onChange={(event) => setInputValue(event.target.value)}
            placeholder={t("search.placeholder")}
            wrapperClassName="flex-1"
            autoFocus
          />
          <ActionButton
            type="submit"
            variant="primary"
            data-testid="search-page-submit"
            disabled={trimmed.length < minChars}
            className="h-10 px-4 shrink-0"
          >
            {t("search.submit")}
          </ActionButton>
        </form>

        {trimmed.length > 0 && trimmed.length < minChars && (
          <p className="mt-3 text-[12px] text-dash-text-muted" data-testid="search-min-chars-hint">
            {t("search.minChars").replace("{count}", String(minChars))}
          </p>
        )}

        {showResults && (
          <div className="mt-6">
            <SearchResultsList
              groups={data?.groups}
              total={data?.total ?? 0}
              query={trimmed}
              loading={loading}
              error={error}
              onSeeMoreGroup={() => setResultLimit((n) => Math.min(40, n + 12))}
              testId="search-page-results"
            />
          </div>
        )}

        {!showResults && trimmed.length === 0 && (
          <div className="mt-6">
            <EmptyState
              icon={Search}
              title={t("search.emptyTitle")}
              description={t("search.emptyDesc")}
              compact
              testId="search-page-empty"
            />
          </div>
        )}
      </div>

      <div className="bg-dash-surface border border-dash-border rounded-xl p-5 md:p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-cabinet text-lg font-bold text-dash-text tracking-tight">
            {t("search.historyTitle")}
          </h3>
          {history.length > 0 && (
            <button
              type="button"
              onClick={clearHistory}
              data-testid="search-history-clear"
              className="text-[11px] text-dash-text-muted hover:text-dash-text transition-colors"
            >
              {t("search.historyClear")}
            </button>
          )}
        </div>

        {history.length === 0 ? (
          <p className="text-[13px] text-dash-text-muted" data-testid="search-history-empty">
            {t("search.historyEmpty")}
          </p>
        ) : (
          <ul className="divide-y divide-dash-border-soft">
            {history.map((query, index) => (
              <li
                key={`${query}-${index}`}
                className="flex items-center justify-between gap-3 py-3 group"
                data-testid={`search-history-${index}`}
              >
                <button
                  type="button"
                  onClick={() => handleHistoryClick(query)}
                  className="flex items-center gap-3 min-w-0 flex-1 text-left"
                >
                  <Clock3 className="w-4 h-4 text-dash-text-subtle shrink-0" />
                  <span className="text-[13px] text-dash-text truncate">{query}</span>
                </button>
                <button
                  type="button"
                  onClick={() => removeSearch(query)}
                  className="p-1.5 text-dash-text-subtle hover:text-[#991B1B] transition-colors sm:opacity-0 sm:group-hover:opacity-100 shrink-0"
                  aria-label={t("search.historyRemove")}
                  data-testid={`search-history-remove-${index}`}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
