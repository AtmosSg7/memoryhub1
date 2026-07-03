import React from "react";
import { motion } from "framer-motion";
import { useLang } from "@/context/LanguageContext";
import { ArrowRight, Play } from "lucide-react";
import { SiGmail, SiGoogledrive, SiNotion } from "react-icons/si";

export const Hero = ({ onJoin, onDemo }) => {
  const { t } = useLang();

  return (
    <section id="top" className="relative hero-mesh overflow-hidden pt-36 md:pt-44 pb-24 md:pb-32">
      <div className="absolute inset-0 grid-lines pointer-events-none" />
      <div className="relative max-w-7xl mx-auto px-6 md:px-10">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="flex justify-center mb-7"
        >
          <span className="pill hover:border-[#D6DAE1] transition-colors" data-testid="hero-pill">
            <span className="relative flex w-1.5 h-1.5">
              <span className="absolute inset-0 rounded-full bg-[#4F46E5] animate-ping opacity-60" />
              <span className="relative w-1.5 h-1.5 rounded-full bg-[#4F46E5]" />
            </span>
            {t("hero.pill")}
          </span>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.75, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
          className="font-display text-center text-[42px] leading-[1.02] sm:text-6xl lg:text-[76px] lg:leading-[1.02] font-black text-[#0A0A0B] tracking-[-0.03em] max-w-5xl mx-auto"
          data-testid="hero-title"
        >
          <span className="block">{t("hero.title_1")}</span>
          <span className="block bg-gradient-to-r from-[#4F46E5] via-[#5B54EA] to-[#0EA5E9] bg-clip-text text-transparent [text-shadow:0_0_60px_rgba(79,70,229,0.15)]">
            {t("hero.title_2")}
          </span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
          className="mt-7 text-center text-[16.5px] md:text-[19px] leading-[1.55] text-[#52535E] max-w-2xl mx-auto"
        >
          {t("hero.subtitle")}
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.32, ease: [0.22, 1, 0.36, 1] }}
          className="mt-11 flex flex-col sm:flex-row items-center justify-center gap-3"
        >
          <button data-testid="hero-cta-primary" onClick={onJoin} className="btn-primary">
            {t("hero.primary")}
            <ArrowRight className="w-4 h-4" />
          </button>
          <button data-testid="hero-cta-secondary" onClick={onDemo} className="btn-ghost">
            <Play className="w-4 h-4" />
            {t("hero.secondary")}
          </button>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, delay: 0.55, ease: [0.22, 1, 0.36, 1] }}
          className="mt-16 flex flex-col items-center gap-5"
        >
          <p className="text-[11px] uppercase tracking-[0.18em] text-[#8A8F98] font-semibold">
            {t("hero.trust")}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-[#52535E]">
            <div className="flex items-center gap-2 opacity-80 hover:opacity-100 transition-opacity duration-300">
              <SiGmail className="w-[18px] h-[18px] text-[#EA4335]" />
              <span className="text-[13.5px] font-medium tracking-tight">Gmail</span>
            </div>
            <div className="w-px h-3.5 bg-black/10" />
            <div className="flex items-center gap-2 opacity-80 hover:opacity-100 transition-opacity duration-300">
              <SiGoogledrive className="w-[18px] h-[18px] text-[#1FA463]" />
              <span className="text-[13.5px] font-medium tracking-tight">Google Drive</span>
            </div>
            <div className="w-px h-3.5 bg-black/10" />
            <div className="flex items-center gap-2 opacity-80 hover:opacity-100 transition-opacity duration-300">
              <SiNotion className="w-[18px] h-[18px] text-[#0A0A0B]" />
              <span className="text-[13.5px] font-medium tracking-tight">Notion</span>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
};
