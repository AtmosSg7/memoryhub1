import React from "react";
import { motion } from "framer-motion";
import { useLang } from "@/context/LanguageContext";
import { Search, Brain, ListTree, Plug, ShieldCheck, Smartphone } from "lucide-react";

const ICONS = [Search, Brain, ListTree, Plug, ShieldCheck, Smartphone];

export const Features = () => {
  const { t } = useLang();
  const items = t("features.items");

  return (
    <section id="features" className="py-24 md:py-32 bg-white">
      <div className="max-w-7xl mx-auto px-6 md:px-10">
        <div className="max-w-2xl mb-14">
          <p className="text-[12px] uppercase tracking-[0.18em] text-[#4F46E5] font-bold mb-3">
            {t("features.kicker")}
          </p>
          <h2 className="font-display text-4xl md:text-5xl lg:text-6xl font-black text-[#0A0A0B] tracking-tight leading-[1.02]">
            {t("features.title")}
          </h2>
          <p className="mt-4 text-[#5E5F6E] text-base md:text-lg leading-relaxed">
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
                className="card-soft p-6 md:p-7 hover:border-[#C7D2FE] hover:shadow-md transition-all group"
                data-testid={`feature-card-${idx}`}
              >
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#EEF2FF] to-[#E0F2FE] flex items-center justify-center mb-5 group-hover:scale-105 transition-transform">
                  <Icon className="w-5 h-5 text-[#4F46E5]" strokeWidth={2.2} />
                </div>
                <h3 className="font-display font-bold text-[18px] text-[#0A0A0B] tracking-tight mb-2">
                  {it.title}
                </h3>
                <p className="text-[14px] text-[#5E5F6E] leading-relaxed">{it.body}</p>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
