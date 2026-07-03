import React from "react";
import { motion } from "framer-motion";
import { useLang } from "@/context/LanguageContext";
import { Search, Brain, ListTree, Plug, ShieldCheck, Smartphone } from "lucide-react";

const ICONS = [Search, Brain, ListTree, Plug, ShieldCheck, Smartphone];

export const Features = () => {
  const { t } = useLang();
  const items = t("features.items");

  return (
    <section id="features" className="py-28 md:py-36 bg-white">
      <div className="max-w-7xl mx-auto px-6 md:px-10">
        <div className="max-w-2xl mb-16">
          <p className="text-[11px] uppercase tracking-[0.2em] text-[#4F46E5] font-bold mb-4">
            {t("features.kicker")}
          </p>
          <h2 className="font-display text-[38px] md:text-[52px] lg:text-[62px] font-black text-[#0A0A0B] tracking-[-0.03em] leading-[1.02]">
            {t("features.title")}
          </h2>
          <p className="mt-5 text-[#52535E] text-base md:text-[17.5px] leading-[1.6]">
            {t("features.subtitle")}
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
          {items.map((it, idx) => {
            const Icon = ICONS[idx % ICONS.length];
            return (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 14 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{ duration: 0.4, delay: idx * 0.05 }}
                className="card-soft card-lift p-7 md:p-8 group cursor-default"
                data-testid={`feature-card-${idx}`}
              >
                <div className="relative w-11 h-11 rounded-xl bg-gradient-to-br from-[#EEF2FF] to-[#E0F2FE] flex items-center justify-center mb-6 shadow-[0_1px_0_rgba(255,255,255,0.9)_inset,0_1px_2px_rgba(79,70,229,0.08)] transition-all duration-500 group-hover:scale-[1.06] group-hover:shadow-[0_1px_0_rgba(255,255,255,0.9)_inset,0_8px_20px_-8px_rgba(79,70,229,0.35)]">
                  <Icon className="w-[19px] h-[19px] text-[#4F46E5]" strokeWidth={2.2} />
                </div>
                <h3 className="font-display font-bold text-[18px] text-[#0A0A0B] tracking-[-0.02em] mb-2.5 leading-tight">
                  {it.title}
                </h3>
                <p className="text-[14px] text-[#52535E] leading-[1.6]">{it.body}</p>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
