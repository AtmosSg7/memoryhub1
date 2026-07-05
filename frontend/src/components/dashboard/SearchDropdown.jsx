import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Search, CornerDownLeft } from "lucide-react";
import { useSearch } from "@/hooks/useSearch";
import { useSearchHistory } from "@/hooks/useSearchHistory";
import { useDashboardLang } from "@/hooks/useDashboardLang";
import SearchResultsList from "@/components/dashboard/SearchResultsList";

export default function SearchDropdown({ query, open, onClose, onNavigate }) {
  const navigate = useNavigate();
  const { t } = useDashboardLang();
  const { addSearch } = useSearchHistory();
  const { data, loading, error, minChars } = useSearch(query, { enabled: open });
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
      className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-white border border-[#E5E7EB] rounded-xl shadow-[0_12px_40px_-12px_rgba(10,37,64,0.25)] overflow-hidden"
    >
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

      <div className="border-t border-[#F3F4F6] px-3 py-2 bg-[#FAFAFA]">
        <button
          type="button"
          onClick={handleViewAll}
          data-testid="search-dropdown-view-all"
          className="w-full flex items-center justify-center gap-2 text-[12px] font-medium text-[#0A2540] hover:text-[#173A5E] py-1.5 transition-colors"
        >
          <Search className="w-3.5 h-3.5" />
          {t("search.viewAll")}
          <CornerDownLeft className="w-3 h-3 text-[#9CA3AF]" />
        </button>
      </div>
    </div>
  );
}
