import React from "react";
import { motion } from "framer-motion";
import { useLang } from "@/context/LanguageContext";
import { ArrowRight } from "lucide-react";

export const FinalCta = ({ onJoin }) => {
  const { t } = useLang();

  return (
    <section className="relative py-28 md:py-36 overflow-hidden bg-[#0A0A0B] text-white">
      <div className="absolute inset-0 opacity-60 pointer-events-none">
        <div className="absolute inset-0"
             style={{
               background:
                 "radial-gradient(700px 300px at 20% 20%, rgba(79,70,229,0.35), transparent 60%), radial-gradient(700px 300px at 80% 80%, rgba(14,165,233,0.25), transparent 60%)",
             }}
        />
      </div>
      <div className="relative max-w-4xl mx-auto px-6 md:px-10 text-center">
        <motion.h2
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="font-display text-5xl md:text-7xl font-black tracking-tight leading-[1.02]"
        >
          {t("finalCta.title")}
        </motion.h2>
        <p className="mt-6 text-white/70 text-lg md:text-xl max-w-2xl mx-auto">
          {t("finalCta.subtitle")}
        </p>
        <div className="mt-10 flex flex-col items-center gap-3">
          <button
            onClick={onJoin}
            data-testid="final-cta-join"
            className="inline-flex items-center gap-2 px-7 py-4 rounded-xl bg-white text-[#0A0A0B] font-bold text-[15px] hover:bg-white/90 transition-all shadow-[0_12px_30px_-8px_rgba(255,255,255,0.3)]"
          >
            {t("finalCta.cta")}
            <ArrowRight className="w-4 h-4" />
          </button>
          <p className="text-white/50 text-[13px]">{t("finalCta.note")}</p>
        </div>
      </div>
    </section>
  );
};
