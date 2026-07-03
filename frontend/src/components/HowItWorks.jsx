import React from "react";
import { motion } from "framer-motion";
import { useLang } from "@/context/LanguageContext";
import { Plug, Sparkles, Search } from "lucide-react";

const ICONS = [Plug, Sparkles, Search];

export const HowItWorks = () => {
  const { t } = useLang();
  const steps = t("how.steps");

  return (
    <section id="how" className="py-28 md:py-36 bg-gradient-to-b from-[#FBFBFC] via-[#F4F5F7] to-[#FBFBFC] border-y border-[#EEF0F3]">
      <div className="max-w-7xl mx-auto px-6 md:px-10">
        <div className="max-w-2xl mb-20">
          <p className="text-[11px] uppercase tracking-[0.2em] text-[#4F46E5] font-bold mb-4">
            {t("how.kicker")}
          </p>
          <h2 className="font-display text-[38px] md:text-[52px] lg:text-[62px] font-black text-[#0A0A0B] tracking-[-0.03em] leading-[1.02]">
            {t("how.title")}
          </h2>
        </div>

        <div className="relative grid md:grid-cols-3 gap-10 md:gap-6">
          {/* connecting line */}
          <div className="hidden md:block absolute top-[28px] left-[10%] right-[10%] h-px bg-gradient-to-r from-transparent via-[#C7D2FE] to-transparent" />

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
                <div className="relative z-10 w-14 h-14 rounded-2xl bg-white border border-[#E7E9EE] shadow-[0_1px_0_rgba(255,255,255,0.8)_inset,0_1px_2px_rgba(10,10,11,0.04),0_10px_24px_-14px_rgba(10,10,11,0.15)] flex items-center justify-center mb-6 transition-transform duration-500 hover:scale-[1.05] hover:-rotate-[3deg]">
                  <Icon className="w-[22px] h-[22px] text-[#4F46E5]" strokeWidth={2.2} />
                </div>
                <p className="font-mono text-[11.5px] text-[#8A8F98] mb-2 tracking-wider">{s.n}</p>
                <h3 className="font-display font-bold text-[26px] text-[#0A0A0B] tracking-[-0.025em] mb-3 leading-[1.15]">
                  {s.title}
                </h3>
                <p className="text-[15px] text-[#52535E] leading-[1.6]">{s.body}</p>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
