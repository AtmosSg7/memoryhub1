import React from "react";
import { motion } from "framer-motion";
import { useLang } from "@/context/LanguageContext";
import { Plug, Sparkles, Search } from "lucide-react";

const ICONS = [Plug, Sparkles, Search];

export const HowItWorks = () => {
  const { t } = useLang();
  const steps = t("how.steps");

  return (
    <section id="how" className="py-24 md:py-32 bg-[#FAFAFB] border-y border-[#E5E7EB]">
      <div className="max-w-7xl mx-auto px-6 md:px-10">
        <div className="max-w-2xl mb-16">
          <p className="text-[12px] uppercase tracking-[0.18em] text-[#4F46E5] font-bold mb-3">
            {t("how.kicker")}
          </p>
          <h2 className="font-display text-4xl md:text-5xl lg:text-6xl font-black text-[#0A0A0B] tracking-tight leading-[1.02]">
            {t("how.title")}
          </h2>
        </div>

        <div className="relative grid md:grid-cols-3 gap-6">
          {/* connecting line */}
          <div className="hidden md:block absolute top-16 left-[12%] right-[12%] h-px bg-gradient-to-r from-transparent via-[#C7D2FE] to-transparent" />

          {steps.map((s, idx) => {
            const Icon = ICONS[idx];
            return (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: idx * 0.1 }}
                className="relative"
                data-testid={`how-step-${idx}`}
              >
                <div className="relative z-10 w-14 h-14 rounded-2xl bg-white border border-[#E5E7EB] shadow-sm flex items-center justify-center mb-5">
                  <Icon className="w-6 h-6 text-[#4F46E5]" strokeWidth={2.2} />
                </div>
                <p className="font-mono text-[12px] text-[#8A8F98] mb-2">{s.n}</p>
                <h3 className="font-display font-bold text-2xl text-[#0A0A0B] tracking-tight mb-3">
                  {s.title}
                </h3>
                <p className="text-[15px] text-[#5E5F6E] leading-relaxed">{s.body}</p>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
