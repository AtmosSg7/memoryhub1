import React, { useEffect } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useLang } from "@/context/LanguageContext";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { applyLegalPlaceholders, legalPlaceholdersPending } from "@/constants/legalConfig";

const DEFAULT_TITLE = "Basera";
const DEFAULT_DESCRIPTION =
  "Basera centralise clients, devis, factures, notes et documents pour les artisans et indépendants.";

export const LegalPageLayout = ({ pageKey }) => {
  const { t, lang } = useLang();

  const title = t(`legal.${pageKey}.title`);
  const metaDescription = t(`legal.${pageKey}.metaDescription`);
  const lastUpdated = t(`legal.${pageKey}.lastUpdated`);
  const sections = t(`legal.${pageKey}.sections`);

  useEffect(() => {
    document.title = `${title} | Basera`;

    let meta = document.querySelector('meta[name="description"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.setAttribute("name", "description");
      document.head.appendChild(meta);
    }
    meta.setAttribute("content", metaDescription);

    return () => {
      document.title = DEFAULT_TITLE;
      const desc = document.querySelector('meta[name="description"]');
      if (desc) desc.setAttribute("content", DEFAULT_DESCRIPTION);
    };
  }, [title, metaDescription, lang]);

  return (
    <div className="App min-h-screen flex flex-col bg-white">
      <Navbar standalone />
      <main className="flex-1 relative hero-mesh pt-28 md:pt-36 pb-28 md:pb-36">
        <div className="absolute inset-0 grid-lines pointer-events-none opacity-60" />
        <div className="relative max-w-4xl mx-auto px-6 md:px-10">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-[13px] font-medium text-[#52535E] hover:text-[#4F46E5] transition-colors duration-200 mb-10"
            data-testid="legal-back-home"
          >
            <ArrowLeft className="w-4 h-4" />
            {t("legal.layout.backHome")}
          </Link>

          <header className="mb-10 md:mb-12">
            <h1 className="font-display text-[32px] sm:text-[40px] md:text-[44px] font-black text-[#0A0A0B] tracking-[-0.03em] leading-[1.08]">
              {title}
            </h1>
            <p className="mt-4 text-[13px] text-[#8A8F98]">
              {t("legal.layout.lastUpdatedLabel")} : {lastUpdated}
            </p>
          </header>

          {legalPlaceholdersPending() && (
            <div
              className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
              data-testid="legal-placeholders-notice"
            >
              {t("legal.layout.placeholdersNotice")}
            </div>
          )}

          <article className="card-soft p-6 md:p-10 space-y-10">
            {Array.isArray(sections) &&
              sections.map((section, idx) => (
                <section key={idx} className="space-y-4">
                  <h2 className="font-display text-[20px] md:text-[22px] font-bold text-[#0A0A0B] tracking-[-0.02em]">
                    {applyLegalPlaceholders(section.heading)}
                  </h2>
                  {Array.isArray(section.paragraphs) &&
                    section.paragraphs.map((para, pIdx) => {
                      if (para?.link) {
                        const { before, text, href, after } = para.link;
                        return (
                          <p
                            key={pIdx}
                            className="text-[15px] md:text-[15.5px] leading-[1.7] text-[#52535E]"
                          >
                            {applyLegalPlaceholders(before)}
                            <Link to={href} className="text-[#4F46E5] hover:underline">
                              {applyLegalPlaceholders(text)}
                            </Link>
                            {applyLegalPlaceholders(after)}
                          </p>
                        );
                      }
                      return (
                        <p
                          key={pIdx}
                          className="text-[15px] md:text-[15.5px] leading-[1.7] text-[#52535E]"
                        >
                          {applyLegalPlaceholders(para)}
                        </p>
                      );
                    })}
                  {Array.isArray(section.list) && section.list.length > 0 && (
                    <ul className="list-disc pl-5 space-y-2 text-[15px] md:text-[15.5px] leading-[1.7] text-[#52535E]">
                      {section.list.map((item, lIdx) => (
                        <li key={lIdx}>{applyLegalPlaceholders(item)}</li>
                      ))}
                    </ul>
                  )}
                </section>
              ))}
          </article>
        </div>
      </main>
      <Footer />
    </div>
  );
};
