import React, { useState, useEffect } from "react";
import { useLang } from "@/context/LanguageContext";
import { Sparkles } from "lucide-react";

export const Navbar = ({ onJoin }) => {
  const { t, lang, setLang } = useLang();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 8);
    on();
    window.addEventListener("scroll", on);
    return () => window.removeEventListener("scroll", on);
  }, []);

  const scrollTo = (id) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <header
      className={`fixed top-0 inset-x-0 z-50 transition-[background,backdrop-filter,border-color,box-shadow,height] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
        scrolled
          ? "backdrop-blur-2xl bg-white/72 border-b border-black/[0.06] shadow-[0_1px_0_rgba(255,255,255,0.6)_inset,0_10px_30px_-20px_rgba(10,10,11,0.15)]"
          : "bg-transparent border-b border-transparent"
      }`}
      data-testid="site-navbar"
    >
      <div className={`max-w-7xl mx-auto px-6 md:px-10 flex items-center justify-between transition-[height] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${scrolled ? "h-14" : "h-16"}`}>
        <a href="#top" className="flex items-center gap-2 group" data-testid="brand-logo">
          <div className="w-8 h-8 rounded-[10px] bg-gradient-to-br from-[#4F46E5] to-[#0EA5E9] flex items-center justify-center shadow-[0_1px_0_rgba(255,255,255,0.2)_inset,0_4px_12px_-4px_rgba(79,70,229,0.5)] transition-transform duration-300 group-hover:scale-[1.04]">
            <Sparkles className="w-4 h-4 text-white" strokeWidth={2.4} />
          </div>
          <span className="font-display text-[17px] font-bold tracking-tight text-[#0A0A0B]">
            MemoryHub
          </span>
        </a>

        <nav className="hidden md:flex items-center gap-1 text-[14px] text-[#52535E] font-medium">
          <button data-testid="nav-features" onClick={() => scrollTo("features")} className="px-3 py-1.5 rounded-lg hover:text-[#0A0A0B] hover:bg-black/[0.03] transition-all duration-200">
            {t("nav.features")}
          </button>
          <button data-testid="nav-how" onClick={() => scrollTo("how")} className="px-3 py-1.5 rounded-lg hover:text-[#0A0A0B] hover:bg-black/[0.03] transition-all duration-200">
            {t("nav.how")}
          </button>
          <button data-testid="nav-pricing" onClick={() => scrollTo("pricing")} className="px-3 py-1.5 rounded-lg hover:text-[#0A0A0B] hover:bg-black/[0.03] transition-all duration-200">
            {t("nav.pricing")}
          </button>
          <button data-testid="nav-faq" onClick={() => scrollTo("faq")} className="px-3 py-1.5 rounded-lg hover:text-[#0A0A0B] hover:bg-black/[0.03] transition-all duration-200">
            {t("nav.faq")}
          </button>
        </nav>

        <div className="flex items-center gap-2">
          <div
            className="hidden sm:flex items-center bg-black/[0.04] border border-black/[0.06] rounded-full p-0.5 text-[11.5px] font-semibold"
            data-testid="lang-switcher"
          >
            <button
              onClick={() => setLang("fr")}
              data-testid="lang-fr"
              className={`px-2.5 py-1 rounded-full transition-all duration-300 ${
                lang === "fr" ? "bg-white text-[#0A0A0B] shadow-[0_1px_2px_rgba(10,10,11,0.08)]" : "text-[#8A8F98] hover:text-[#52535E]"
              }`}
            >
              FR
            </button>
            <button
              onClick={() => setLang("en")}
              data-testid="lang-en"
              className={`px-2.5 py-1 rounded-full transition-all duration-300 ${
                lang === "en" ? "bg-white text-[#0A0A0B] shadow-[0_1px_2px_rgba(10,10,11,0.08)]" : "text-[#8A8F98] hover:text-[#52535E]"
              }`}
            >
              EN
            </button>
          </div>
          <button
            data-testid="nav-cta-join"
            onClick={onJoin}
            className="btn-primary text-[13px] py-2.5 px-4"
          >
            {t("nav.cta")}
          </button>
        </div>
      </div>
    </header>
  );
};
