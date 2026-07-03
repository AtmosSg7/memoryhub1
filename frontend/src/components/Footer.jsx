import React from "react";
import { useLang } from "@/context/LanguageContext";
import { Sparkles } from "lucide-react";

export const Footer = () => {
  const { t } = useLang();
  return (
    <footer className="bg-white border-t border-[#E5E7EB]" data-testid="site-footer">
      <div className="max-w-7xl mx-auto px-6 md:px-10 py-14">
        <div className="grid md:grid-cols-4 gap-10">
          <div className="md:col-span-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#4F46E5] to-[#0EA5E9] flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <span className="font-display text-[17px] font-bold tracking-tight text-[#0A0A0B]">MemoryHub</span>
            </div>
            <p className="mt-4 max-w-sm text-[14px] text-[#5E5F6E] leading-relaxed">{t("footer.tagline")}</p>
          </div>
          <div>
            <p className="text-[12px] uppercase tracking-wider text-[#8A8F98] font-bold mb-4">{t("footer.product")}</p>
            <ul className="space-y-2.5 text-[14px] text-[#0A0A0B]/85">
              <li><a href="#features" className="hover:text-[#4F46E5]">{t("nav.features")}</a></li>
              <li><a href="#pricing" className="hover:text-[#4F46E5]">{t("nav.pricing")}</a></li>
              <li><a href="#faq" className="hover:text-[#4F46E5]">{t("nav.faq")}</a></li>
            </ul>
          </div>
          <div>
            <p className="text-[12px] uppercase tracking-wider text-[#8A8F98] font-bold mb-4">{t("footer.company")}</p>
            <ul className="space-y-2.5 text-[14px] text-[#0A0A0B]/85">
              <li><a href="#" className="hover:text-[#4F46E5]">{t("footer.about")}</a></li>
              <li><a href="#" className="hover:text-[#4F46E5]">{t("footer.contact")}</a></li>
              <li><a href="#" className="hover:text-[#4F46E5]">{t("footer.privacy")}</a></li>
              <li><a href="#" className="hover:text-[#4F46E5]">{t("footer.terms")}</a></li>
            </ul>
          </div>
        </div>
        <div className="mt-12 pt-6 border-t border-[#EEF0F3] flex flex-col sm:flex-row items-center justify-between gap-3 text-[12px] text-[#8A8F98]">
          <p>© {new Date().getFullYear()} MemoryHub. {t("footer.rights")}</p>
          <p className="font-mono">Made in France · Hosted in Europe</p>
        </div>
      </div>
    </footer>
  );
};
