import { useNavigate } from "react-router-dom";
import { Search, CornerDownLeft } from "lucide-react";
import { useDashboardLang } from "@/hooks/useDashboardLang";

export default function SearchPreview() {
  const { t } = useDashboardLang();
  const navigate = useNavigate();

  return (
    <section
      data-testid="search-preview"
      className="relative overflow-hidden rounded-xl bg-gradient-to-br from-[#0A2540] via-[#0F2E4F] to-[#173A5E] text-white p-5 md:p-6 shadow-[0_10px_40px_-20px_rgba(10,37,64,0.6)]"
    >
      <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-[#0066FF]/25 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-16 -left-10 w-40 h-40 rounded-full bg-[#7BB8FF]/10 blur-3xl pointer-events-none" />
      <div className="grain absolute inset-0 pointer-events-none rounded-xl" />

      <div className="relative">
        <div className="flex items-center gap-2 mb-4">
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-white/10 border border-white/15 text-[10px] uppercase tracking-widest text-white/80">
            <Search className="w-3 h-3 text-[#7BB8FF]" />
            {t("search.eyebrow")}
          </span>
        </div>

        <h3 className="font-cabinet text-xl md:text-[22px] font-bold tracking-tight mb-2">
          {t("search.preview.title")}
        </h3>
        <p className="text-[13px] text-white/70 mb-4 leading-relaxed">
          {t("search.preview.subtitle")}
        </p>

        <button
          type="button"
          onClick={() => navigate("/dashboard/search")}
          data-testid="search-preview-cta"
          className="w-full flex items-center gap-2 bg-white/5 border border-white/15 backdrop-blur-md rounded-lg px-3 py-2.5 hover:bg-white/10 transition-colors text-left"
        >
          <Search className="w-3.5 h-3.5 text-[#7BB8FF] shrink-0" />
          <span className="text-[13px] text-white/85 flex-1 truncate">
            {t("search.placeholder")}
          </span>
          <kbd className="hidden sm:inline-flex text-[10px] px-1.5 py-0.5 rounded border border-white/20 bg-white/5 text-white/70 items-center gap-1">
            <CornerDownLeft className="w-2.5 h-2.5" />
          </kbd>
        </button>
      </div>
    </section>
  );
}
