import React from "react";
import { Link } from "react-router-dom";
import { useLang } from "@/context/LanguageContext";
import { Sparkles } from "lucide-react";

export const Footer = () => {
  const { t } = useLang();
  return (
    <footer className="bg-white border-t border-[#EEF0F3]" data-testid="site-footer">
      <div className="max-w-7xl mx-auto px-6 md:px-10 py-16">
        <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-10 md:gap-14">
          <div className="sm:col-span-2 md:col-span-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-[10px] bg-gradient-to-br from-[#4F46E5] to-[#0EA5E9] flex items-center justify-center shadow-[0_1px_0_rgba(255,255,255,0.2)_inset,0_4px_12px_-4px_rgba(79,70,229,0.5)]">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <span className="font-display text-[17px] font-bold tracking-tight text-[#0A0A0B]">MemoryHub</span>
            </div>
            <p className="mt-5 max-w-sm text-[14.5px] text-[#52535E] leading-[1.6]">{t("footer.tagline")}</p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-[0.16em] text-[#8A8F98] font-bold mb-5">{t("footer.product")}</p>
            <ul className="space-y-3 text-[14px] text-[#0A0A0B]/85">
              <li><Link to="/#features" className="hover:text-[#4F46E5] transition-colors duration-200">{t("nav.features")}</Link></li>
              <li><Link to="/#pricing" className="hover:text-[#4F46E5] transition-colors duration-200">{t("nav.pricing")}</Link></li>
              <li><Link to="/#faq" className="hover:text-[#4F46E5] transition-colors duration-200">{t("nav.faq")}</Link></li>
            </ul>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-[0.16em] text-[#8A8F98] font-bold mb-5">{t("footer.legal")}</p>
            <ul className="space-y-3 text-[14px] text-[#0A0A0B]/85">
              <li><Link to="/mentions-legales" className="hover:text-[#4F46E5] transition-colors duration-200">{t("footer.legalNotice")}</Link></li>
              <li><Link to="/politique-de-confidentialite" className="hover:text-[#4F46E5] transition-colors duration-200">{t("footer.privacy")}</Link></li>
              <li><Link to="/cgu" className="hover:text-[#4F46E5] transition-colors duration-200">{t("footer.terms")}</Link></li>
              <li><Link to="/cookies" className="hover:text-[#4F46E5] transition-colors duration-200">{t("footer.cookies")}</Link></li>
            </ul>
          </div>
        </div>
        <div className="mt-14 pt-6 border-t border-[#EEF0F3] flex flex-col sm:flex-row items-center justify-between gap-3 text-[12px] text-[#8A8F98]">
          <p>© {new Date().getFullYear()} MemoryHub. {t("footer.rights")}</p>
          <p className="font-mono tracking-tight">Made in France · Hosted in Europe</p>
        </div>
      </div>
    </footer>
  );
};
