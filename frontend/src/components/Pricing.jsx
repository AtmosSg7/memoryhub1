import React from "react";
import { motion } from "framer-motion";
import { useLang } from "@/context/LanguageContext";
import { Check, ArrowRight } from "lucide-react";

export const Pricing = ({ onJoin }) => {
  const { t } = useLang();
  const plans = t("pricing.plans");

  return (
    <section id="pricing" className="py-24 md:py-32 bg-white">
      <div className="max-w-7xl mx-auto px-6 md:px-10">
        <div className="text-center max-w-2xl mx-auto mb-14">
          <p className="text-[12px] uppercase tracking-[0.18em] text-[#4F46E5] font-bold mb-3">
            {t("pricing.kicker")}
          </p>
          <h2 className="font-display text-4xl md:text-5xl lg:text-6xl font-black text-[#0A0A0B] tracking-tight leading-[1.02]">
            {t("pricing.title")}
          </h2>
          <p className="mt-4 text-[#5E5F6E] text-base md:text-lg">{t("pricing.subtitle")}</p>
        </div>

        <div className="grid md:grid-cols-3 gap-5 md:gap-6">
          {plans.map((p, idx) => {
            const highlight = idx === 1;
            return (
              <motion.div
                key={p.name}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.45, delay: idx * 0.08 }}
                className={`relative rounded-3xl p-8 border ${
                  highlight
                    ? "bg-[#0A0A0B] text-white border-transparent shadow-[0_20px_60px_-20px_rgba(79,70,229,0.55)]"
                    : "bg-white text-[#0A0A0B] border-[#E5E7EB] shadow-[0_8px_24px_-16px_rgba(10,10,11,0.15)]"
                }`}
                data-testid={`pricing-plan-${p.name.toLowerCase()}`}
              >
                {highlight && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="pill" style={{ background: "linear-gradient(90deg,#4F46E5,#0EA5E9)", color: "#fff", border: "none" }}>
                      {t("pricing.most")}
                    </span>
                  </div>
                )}
                <h3 className={`font-display text-2xl font-bold tracking-tight ${highlight ? "text-white" : "text-[#0A0A0B]"}`}>
                  {p.name}
                </h3>
                <p className={`mt-2 text-[14px] ${highlight ? "text-white/70" : "text-[#5E5F6E]"}`}>{p.desc}</p>
                <div className="mt-6 flex items-baseline gap-1">
                  <span className={`font-display text-5xl font-black ${highlight ? "text-white" : "text-[#0A0A0B]"}`}>{p.price}€</span>
                  <span className={`text-[14px] ${highlight ? "text-white/60" : "text-[#8A8F98]"}`}>{t("pricing.per")}</span>
                </div>
                <button
                  onClick={onJoin}
                  data-testid={`pricing-cta-${p.name.toLowerCase()}`}
                  className={`mt-6 w-full inline-flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-[14px] transition-all ${
                    highlight
                      ? "bg-white text-[#0A0A0B] hover:bg-white/90"
                      : "bg-[#0A0A0B] text-white hover:bg-[#22222A]"
                  }`}
                >
                  {t("pricing.cta")}
                  <ArrowRight className="w-4 h-4" />
                </button>
                <ul className="mt-7 space-y-3">
                  {p.features.map((f) => (
                    <li key={f} className={`flex items-start gap-2.5 text-[14px] ${highlight ? "text-white/85" : "text-[#0A0A0B]/85"}`}>
                      <Check className={`w-4 h-4 mt-0.5 flex-shrink-0 ${highlight ? "text-[#0EA5E9]" : "text-[#4F46E5]"}`} strokeWidth={2.6} />
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
