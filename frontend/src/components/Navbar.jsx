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
      className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${
        scrolled ? "backdrop-blur-xl bg-white/75 border-b border-gray-200/60" : "bg-transparent"
      }`}
      data-testid="site-navbar"
    >
      <div className="max-w-7xl mx-auto px-6 md:px-10 h-16 flex items-center justify-between">
        <a href="#top" className="flex items-center gap-2" data-testid="brand-logo">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#4F46E5] to-[#0EA5E9] flex items-center justify-center shadow-sm">
            <Sparkles className="w-4 h-4 text-white" strokeWidth={2.4} />
          </div>
          <span className="font-display text-[17px] font-bold tracking-tight text-[#0A0A0B]">
            MemoryHub
          </span>
        </a>

        <nav className="hidden md:flex items-center gap-8 text-[14px] text-[#5E5F6E] font-medium">
          <button data-testid="nav-features" onClick={() => scrollTo("features")} className="hover:text-[#0A0A0B] transition-colors">
            {t("nav.features")}
          </button>
          <button data-testid="nav-how" onClick={() => scrollTo("how")} className="hover:text-[#0A0A0B] transition-colors">
            {t("nav.how")}
          </button>
          <button data-testid="nav-pricing" onClick={() => scrollTo("pricing")} className="hover:text-[#0A0A0B] transition-colors">
            {t("nav.pricing")}
          </button>
          <button data-testid="nav-faq" onClick={() => scrollTo("faq")} className="hover:text-[#0A0A0B] transition-colors">
            {t("nav.faq")}
          </button>
        </nav>

        <div className="flex items-center gap-2">
          <div
            className="hidden sm:flex items-center bg-[#F4F5F7] border border-[#E5E7EB] rounded-full p-0.5 text-[12px] font-semibold"
            data-testid="lang-switcher"
          >
            <button
              onClick={() => setLang("fr")}
              data-testid="lang-fr"
              className={`px-3 py-1 rounded-full transition-colors ${
                lang === "fr" ? "bg-white text-[#0A0A0B] shadow-sm" : "text-[#8A8F98]"
              }`}
            >
              FR
            </button>
            <button
              onClick={() => setLang("en")}
              data-testid="lang-en"
              className={`px-3 py-1 rounded-full transition-colors ${
                lang === "en" ? "bg-white text-[#0A0A0B] shadow-sm" : "text-[#8A8F98]"
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
