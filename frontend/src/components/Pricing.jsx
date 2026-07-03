import React from "react";
import { motion } from "framer-motion";
import { useLang } from "@/context/LanguageContext";
import { Check, ArrowRight } from "lucide-react";

export const Pricing = ({ onJoin }) => {
  const { t } = useLang();
  const plans = t("pricing.plans");

  return (
    <section id="pricing" className="py-28 md:py-36 bg-white">
      <div className="max-w-7xl mx-auto px-6 md:px-10">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <p className="text-[11px] uppercase tracking-[0.2em] text-[#4F46E5] font-bold mb-4">
            {t("pricing.kicker")}
          </p>
          <h2 className="font-display text-[38px] md:text-[52px] lg:text-[62px] font-black text-[#0A0A0B] tracking-[-0.03em] leading-[1.02]">
            {t("pricing.title")}
          </h2>
          <p className="mt-5 text-[#52535E] text-base md:text-[17.5px]">{t("pricing.subtitle")}</p>
        </div>

        <div className="grid md:grid-cols-3 gap-5 md:gap-6 lg:gap-7 items-stretch">
          {plans.map((p, idx) => {
            const highlight = idx === 1;
            return (
              <motion.div
                key={p.name}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.45, delay: idx * 0.08 }}
                whileHover={{ y: -4 }}
                className={`relative rounded-[22px] p-8 border transition-[box-shadow,border-color] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                  highlight
                    ? "bg-[#0A0A0B] text-white border-transparent shadow-[0_1px_0_rgba(255,255,255,0.08)_inset,0_24px_70px_-24px_rgba(79,70,229,0.55),0_10px_30px_-20px_rgba(10,10,11,0.6)] md:scale-[1.02]"
                    : "bg-white text-[#0A0A0B] border-[#E7E9EE] shadow-[0_1px_0_rgba(255,255,255,0.6)_inset,0_1px_2px_rgba(10,10,11,0.03),0_16px_36px_-24px_rgba(10,10,11,0.14)] hover:border-[#D6DAE1] hover:shadow-[0_1px_0_rgba(255,255,255,0.7)_inset,0_2px_6px_rgba(10,10,11,0.04),0_28px_60px_-28px_rgba(10,10,11,0.2)]"
                }`}
                data-testid={`pricing-plan-${p.name.toLowerCase()}`}
              >
                {highlight && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold text-white shadow-[0_1px_0_rgba(255,255,255,0.2)_inset,0_6px_16px_-4px_rgba(79,70,229,0.5)]" style={{ background: "linear-gradient(90deg,#4F46E5,#0EA5E9)" }}>
                      <span className="w-1 h-1 rounded-full bg-white" />
                      {t("pricing.most")}
                    </span>
                  </div>
                )}
                <h3 className={`font-display text-[24px] font-bold tracking-[-0.025em] ${highlight ? "text-white" : "text-[#0A0A0B]"}`}>
                  {p.name}
                </h3>
                <p className={`mt-2 text-[13.5px] leading-[1.55] ${highlight ? "text-white/65" : "text-[#52535E]"}`}>{p.desc}</p>
                <div className="mt-7 flex items-baseline gap-1">
                  <span className={`font-display text-[52px] font-black tracking-[-0.03em] leading-none ${highlight ? "text-white" : "text-[#0A0A0B]"}`}>{p.price}€</span>
                  <span className={`text-[13.5px] ${highlight ? "text-white/55" : "text-[#8A8F98]"}`}>{t("pricing.per")}</span>
                </div>
                <button
                  onClick={onJoin}
                  data-testid={`pricing-cta-${p.name.toLowerCase()}`}
                  className={`group/cta mt-7 w-full inline-flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-[14px] tracking-tight transition-all duration-300 ${
                    highlight
                      ? "bg-white text-[#0A0A0B] hover:bg-white/95 shadow-[0_1px_0_rgba(255,255,255,0.4)_inset,0_10px_24px_-8px_rgba(255,255,255,0.35)]"
                      : "bg-[#0A0A0B] text-white hover:bg-[#22222A] shadow-[0_1px_0_rgba(255,255,255,0.08)_inset,0_10px_20px_-12px_rgba(10,10,11,0.5)]"
                  }`}
                >
                  {t("pricing.cta")}
                  <ArrowRight className="w-4 h-4 transition-transform duration-300 group-hover/cta:translate-x-0.5" />
                </button>
                <ul className="mt-8 space-y-3.5">
                  {p.features.map((f) => (
                    <li key={f} className={`flex items-start gap-3 text-[14px] leading-[1.5] ${highlight ? "text-white/85" : "text-[#0A0A0B]/85"}`}>
                      <span className={`flex-shrink-0 mt-0.5 w-4 h-4 rounded-full flex items-center justify-center ${highlight ? "bg-white/10" : "bg-[#EEF2FF]"}`}>
                        <Check className={`w-3 h-3 ${highlight ? "text-[#0EA5E9]" : "text-[#4F46E5]"}`} strokeWidth={3} />
                      </span>
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
