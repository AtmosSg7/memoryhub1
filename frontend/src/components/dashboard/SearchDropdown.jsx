import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Search, X } from "lucide-react";
import { useSearch } from "@/hooks/useSearch";
import { useSearchHistory } from "@/hooks/useSearchHistory";
import { useDashboardLang } from "@/hooks/useDashboardLang";
import SearchResultsList from "@/components/dashboard/SearchResultsList";

export default function SearchDropdown({
  query,
  open,
  onClose,
  onNavigate,
  onQueryChange,
}) {
  const navigate = useNavigate();
  const { t } = useDashboardLang();
  const { addSearch } = useSearchHistory();
  const { data, loading, error, minChars } = useSearch(query, {
    enabled: open,
    limit: 8,
  });
  const ref = useRef(null);

  const trimmed = (query || "").trim();
  const showDropdown = open && trimmed.length >= minChars;

  useEffect(() => {
    if (!showDropdown) return undefined;

    const handleClickOutside = (event) => {
      if (ref.current && !ref.current.contains(event.target)) {
        onClose?.();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showDropdown, onClose]);

  useEffect(() => {
    if (!showDropdown) return undefined;
    const prev = document.body.style.overflow;
    const isMobile = window.matchMedia("(max-width: 767px)").matches;
    if (isMobile) document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [showDropdown]);

  if (!showDropdown) return null;

  const handleViewAll = () => {
    addSearch(trimmed);
    onNavigate?.();
    onClose?.();
    navigate(`/dashboard/search?q=${encodeURIComponent(trimmed)}`);
  };

  return (
    <div
      ref={ref}
      data-testid="search-dropdown"
      className={[
        "z-50 bg-dash-surface overflow-hidden",
        "fixed inset-0 flex flex-col",
        "md:absolute md:inset-auto md:left-0 md:right-0 md:top-full md:mt-1.5",
        "md:rounded-xl md:border md:border-dash-border",
        "md:shadow-[0_12px_40px_-12px_rgba(10,37,64,0.25)] md:max-h-[min(70vh,28rem)]",
      ].join(" ")}
    >
      <div className="md:hidden flex items-center gap-2 px-4 py-3 border-b border-dash-border-soft shrink-0">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dash-text-subtle" />
          <input
            type="search"
            value={query}
            onChange={(event) => onQueryChange?.(event.target.value)}
            className="w-full h-11 pl-10 pr-3 rounded-xl border border-dash-border bg-dash-bg text-sm text-dash-text"
            placeholder={t("search.placeholder")}
            autoFocus
            data-testid="search-dropdown-mobile-input"
          />
        </div>
        <button
          type="button"
          onClick={onClose}
          className="h-11 px-3 rounded-xl text-sm font-medium text-dash-text-muted"
          data-testid="search-dropdown-close"
        >
          <X className="w-5 h-5" />
          <span className="sr-only">{t("search.mobileClose")}</span>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto overscroll-contain min-h-0">
        <SearchResultsList
          groups={data?.groups}
          total={data?.total ?? 0}
          query={trimmed}
          loading={loading}
          error={error}
          onSelect={() => {
            addSearch(trimmed);
            onClose?.();
          }}
          compact
          showSummary={false}
          testId="search-dropdown-results"
        />
      </div>

      <div className="border-t border-dash-border-soft px-3 py-2 bg-dash-surface-muted shrink-0">
        <button
          type="button"
          onClick={handleViewAll}
          data-testid="search-dropdown-view-all"
          className="w-full flex items-center justify-center gap-2 text-[12px] font-medium text-dash-primary hover:text-[#173A5E] py-2.5 min-h-11 transition-colors"
        >
          <Search className="w-3.5 h-3.5" />
          {t("search.viewAll")}
        </button>
      </div>
    </div>
  );
}
