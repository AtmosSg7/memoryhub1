import React from "react";
import { motion } from "framer-motion";
import { useLang } from "@/context/LanguageContext";
import { ArrowRight } from "lucide-react";

export const FinalCta = ({ onJoin }) => {
  const { t } = useLang();

  return (
    <section className="relative py-32 md:py-40 overflow-hidden bg-[#0A0A0B] text-white">
      <div className="absolute inset-0 opacity-70 pointer-events-none">
        <div className="absolute inset-0"
             style={{
               background:
                 "radial-gradient(700px 340px at 20% 20%, rgba(79,70,229,0.4), transparent 60%), radial-gradient(700px 340px at 80% 80%, rgba(14,165,233,0.28), transparent 60%)",
             }}
        />
      </div>
      {/* Subtle grid on dark */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.06]"
           style={{
             backgroundImage:
               "linear-gradient(to right, #fff 1px, transparent 1px), linear-gradient(to bottom, #fff 1px, transparent 1px)",
             backgroundSize: "56px 56px",
             maskImage: "radial-gradient(ellipse 60% 60% at center, black 30%, transparent 78%)",
             WebkitMaskImage: "radial-gradient(ellipse 60% 60% at center, black 30%, transparent 78%)",
           }}
      />
      <div className="relative max-w-4xl mx-auto px-6 md:px-10 text-center">
        <motion.h2
          initial={{ opacity: 0, y: 14 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="font-display text-[44px] md:text-[76px] font-black tracking-[-0.03em] leading-[1.02]"
        >
          {t("finalCta.title")}
        </motion.h2>
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
          className="mt-6 text-white/65 text-lg md:text-xl max-w-2xl mx-auto leading-[1.55]"
        >
          {t("finalCta.subtitle")}
        </motion.p>
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
          className="mt-10 flex flex-col items-center gap-3.5"
        >
          <button
            onClick={onJoin}
            data-testid="final-cta-join"
            className="group inline-flex items-center gap-2 px-7 py-4 rounded-xl bg-white text-[#0A0A0B] font-bold text-[15px] tracking-tight hover:bg-white/95 transition-all duration-300 shadow-[0_1px_0_rgba(255,255,255,0.4)_inset,0_16px_36px_-8px_rgba(255,255,255,0.35)] hover:-translate-y-0.5"
          >
            {t("finalCta.cta")}
            <ArrowRight className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-0.5" />
          </button>
          <p className="text-white/45 text-[13px]">{t("finalCta.note")}</p>
        </motion.div>
      </div>
    </section>
  );
};
