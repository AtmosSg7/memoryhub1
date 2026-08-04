import { useNavigate } from "react-router-dom";
import { Search } from "lucide-react";
import { useDashboardLang } from "@/hooks/useDashboardLang";

export default function SearchPreview() {
  const { t } = useDashboardLang();
  const navigate = useNavigate();

  return (
    <section
      data-testid="search-preview"
      className="relative overflow-hidden rounded-xl border border-dash-border bg-dash-surface-elevated text-dash-text p-5 md:p-6 shadow-[var(--dash-card-shadow)]"
    >
      <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-[var(--dash-accent-soft)] blur-3xl pointer-events-none" />
      <div className="absolute -bottom-16 -left-10 w-40 h-40 rounded-full bg-[var(--dash-info-bg)] blur-3xl pointer-events-none" />

      <div className="relative">
        <div className="flex items-center gap-2 mb-4">
          <span className="dash-badge dash-badge-info">
            <Search className="w-3 h-3" />
            {t("search.eyebrow")}
          </span>
        </div>

        <h3 className="dash-display text-xl md:text-[22px] font-bold tracking-tight mb-2">
          {t("search.preview.title")}
        </h3>
        <p className="text-[13px] text-dash-text-muted mb-4 leading-relaxed">
          {t("search.preview.subtitle")}
        </p>

        <button
          type="button"
          onClick={() => navigate("/dashboard/search")}
          data-testid="search-preview-cta"
          className="w-full flex items-center gap-2 rounded-xl border border-dash-border bg-[var(--dash-input-bg)] px-3 py-2.5 hover:bg-[var(--dash-input-bg-hover)] transition-colors text-left"
        >
          <Search className="w-3.5 h-3.5 text-dash-accent shrink-0" />
          <span className="text-[13px] text-dash-text-subtle flex-1 truncate">
            {t("search.placeholder")}
          </span>
        </button>
      </div>
    </section>
  );
}
