import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Search, Clock3, ArrowUpRight, X } from "lucide-react";
import { useDashboardLang } from "@/hooks/useDashboardLang";
import { usePageTitle } from "@/hooks/usePageTitle";
import { useSearch, SEARCH_MIN_CHARS } from "@/hooks/useSearch";
import { useSearchHistory } from "@/hooks/useSearchHistory";
import PageHeader from "@/components/dashboard/PageHeader";
import SearchResultsList from "@/components/dashboard/SearchResultsList";
import EmptyState from "@/components/dashboard/EmptyState";

export default function SearchPage() {
  const { t } = useDashboardLang();
  usePageTitle("page.search.title");
  const [searchParams, setSearchParams] = useSearchParams();
  const { history, addSearch, removeSearch, clearHistory } = useSearchHistory();

  const urlQuery = searchParams.get("q") || "";
  const [inputValue, setInputValue] = useState(urlQuery);

  const minChars = SEARCH_MIN_CHARS;
  const { data, loading, error } = useSearch(inputValue, {
    enabled: inputValue.trim().length >= minChars,
  });

  useEffect(() => {
    setInputValue(urlQuery);
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
        eyebrow={t("search.eyebrow")}
        title={t("page.search.title")}
        subtitle={t("page.search.subtitle")}
        testId="search-header"
      />

      <div className="bg-white border border-[#E5E7EB] rounded-xl p-5 md:p-6">
        <form onSubmit={handleSubmit}>
          <div className="flex items-center gap-2 border border-[#E5E7EB] rounded-lg px-3 py-3 bg-[#FAFAFA] focus-within:bg-white focus-within:border-[#0A2540]/40 focus-within:ring-2 focus-within:ring-[#0A2540]/10 transition-all">
            <Search className="w-4 h-4 text-[#9CA3AF] shrink-0" />
            <input
              data-testid="search-page-input"
              type="text"
              value={inputValue}
              onChange={(event) => setInputValue(event.target.value)}
              placeholder={t("search.placeholder")}
              className="flex-1 bg-transparent outline-none text-sm placeholder:text-[#9CA3AF] text-[#111827]"
              autoFocus
            />
            <button
              type="submit"
              data-testid="search-page-submit"
              disabled={trimmed.length < minChars}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#0A2540] hover:bg-[#173A5E] disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-medium transition-colors"
            >
              {t("search.submit")}
            </button>
          </div>
        </form>

        {trimmed.length > 0 && trimmed.length < minChars && (
          <p className="mt-3 text-[12px] text-[#6B7280]" data-testid="search-min-chars-hint">
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
              testId="search-page-results"
            />
          </div>
        )}

        {!showResults && (
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

      <div className="bg-white border border-[#E5E7EB] rounded-xl p-5 md:p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-cabinet text-lg font-bold text-[#111827] tracking-tight">
            {t("search.historyTitle")}
          </h3>
          {history.length > 0 && (
            <button
              type="button"
              onClick={clearHistory}
              data-testid="search-history-clear"
              className="text-[11px] text-[#6B7280] hover:text-[#111827] transition-colors"
            >
              {t("search.historyClear")}
            </button>
          )}
        </div>

        {history.length === 0 ? (
          <p className="text-[13px] text-[#6B7280]" data-testid="search-history-empty">
            {t("search.historyEmpty")}
          </p>
        ) : (
          <ul className="divide-y divide-[#F3F4F6]">
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
                  <Clock3 className="w-4 h-4 text-[#9CA3AF] shrink-0" />
                  <span className="text-[13px] text-[#111827] truncate">{query}</span>
                </button>
                <button
                  type="button"
                  onClick={() => removeSearch(query)}
                  className="opacity-0 group-hover:opacity-100 p-1 text-[#9CA3AF] hover:text-[#991B1B] transition-all"
                  aria-label={t("search.historyRemove")}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
                <ArrowUpRight className="w-3.5 h-3.5 text-[#9CA3AF] group-hover:text-[#0A2540] transition-colors shrink-0" />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
