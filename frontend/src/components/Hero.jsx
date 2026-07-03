import React from "react";
import { motion } from "framer-motion";
import { useLang } from "@/context/LanguageContext";
import { ArrowRight, Play } from "lucide-react";
import { SiGmail, SiGoogledrive, SiNotion } from "react-icons/si";

export const Hero = ({ onJoin, onDemo }) => {
  const { t } = useLang();

  return (
    <section id="top" className="relative hero-mesh overflow-hidden pt-32 md:pt-40 pb-20 md:pb-28">
      <div className="absolute inset-0 grid-lines pointer-events-none" />
      <div className="relative max-w-7xl mx-auto px-6 md:px-10">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex justify-center mb-6"
        >
          <span className="pill" data-testid="hero-pill">
            <span className="w-1.5 h-1.5 rounded-full bg-[#4F46E5] shadow-[0_0_10px_rgba(79,70,229,0.7)]" />
            {t("hero.pill")}
          </span>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.05 }}
          className="font-display text-center text-[40px] leading-[1.02] sm:text-6xl lg:text-7xl font-black text-[#0A0A0B] tracking-tight max-w-5xl mx-auto"
          data-testid="hero-title"
        >
          <span className="block">{t("hero.title_1")}</span>
          <span className="block bg-gradient-to-r from-[#4F46E5] via-[#4338CA] to-[#0EA5E9] bg-clip-text text-transparent">
            {t("hero.title_2")}
          </span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.15 }}
          className="mt-6 text-center text-[16px] md:text-[18px] leading-relaxed text-[#5E5F6E] max-w-2xl mx-auto"
        >
          {t("hero.subtitle")}
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.28 }}
          className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3"
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
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.5 }}
          className="mt-14 flex flex-col items-center gap-4"
        >
          <p className="text-[12px] uppercase tracking-[0.14em] text-[#8A8F98] font-semibold">
            {t("hero.trust")}
          </p>
          <div className="flex items-center gap-8 text-[#5E5F6E]">
            <div className="flex items-center gap-2">
              <SiGmail className="w-5 h-5 text-[#EA4335]" />
              <span className="text-sm font-medium">Gmail</span>
            </div>
            <div className="w-px h-4 bg-[#E5E7EB]" />
            <div className="flex items-center gap-2">
              <SiGoogledrive className="w-5 h-5 text-[#1FA463]" />
              <span className="text-sm font-medium">Google Drive</span>
            </div>
            <div className="w-px h-4 bg-[#E5E7EB]" />
            <div className="flex items-center gap-2">
              <SiNotion className="w-5 h-5 text-[#0A0A0B]" />
              <span className="text-sm font-medium">Notion</span>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
};
