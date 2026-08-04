import { useState } from "react";
import { motion } from "framer-motion";
import { Check, ChevronDown, Minus, ArrowRight, Star } from "lucide-react";
import { useLang } from "@/context/LanguageContext";
import {
  PLAN_CATALOG,
  PLAN_COMPARISON_SECTIONS,
  comparisonValueForPlan,
  formatPlanLimit,
  formatPlanPrice,
} from "@/constants/planConfig";

function planName(t, planId) {
  return t(`pricing.plans.${planId}.name`);
}

function ComparisonCell({ value, t, lang, rowId, inverted = false }) {
  if (typeof value === "number") {
    let label;
    if (rowId === "imports") {
      label = t("pricingComparison.values.importsPerMonth").replace(
        "{count}",
        formatPlanLimit(value, lang)
      );
    } else if (rowId === "clients") {
      label = t("pricingComparison.values.clients").replace(
        "{count}",
        formatPlanLimit(value, lang)
      );
    } else if (rowId === "documents") {
      label = t("pricingComparison.values.documents").replace(
        "{count}",
        formatPlanLimit(value, lang)
      );
    } else {
      label = formatPlanLimit(value, lang);
    }

    return (
      <span
        className={[
          "text-[13px] font-semibold tabular-nums leading-snug",
          inverted ? "text-white" : "text-[#0A0A0B]",
        ].join(" ")}
      >
        {label}
      </span>
    );
  }

  if (value === "included") {
    return (
      <span className="inline-flex items-center gap-1.5">
        <span
          className={[
            "w-6 h-6 rounded-full flex items-center justify-center shrink-0",
            inverted ? "bg-white/15" : "bg-[#ECFDF5]",
          ].join(" ")}
        >
          <Check
            className={`w-3.5 h-3.5 ${inverted ? "text-[#6EE7B7]" : "text-[#059669]"}`}
            strokeWidth={3}
            aria-hidden
          />
        </span>
        <span className="sr-only">{t("pricingComparison.states.included")}</span>
      </span>
    );
  }

  if (value === "soon") {
    return (
      <span
        className={[
          "inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold",
          inverted
            ? "border-white/20 bg-white/10 text-white"
            : "border-[#DBEAFE] bg-[#EFF6FF] text-[#1D4ED8]",
        ].join(" ")}
      >
        {t("pricingComparison.states.soon")}
      </span>
    );
  }

  return (
    <span className={`inline-flex items-center gap-1.5 ${inverted ? "text-white/50" : "text-[#9CA3AF]"}`}>
      <Minus className="w-4 h-4" strokeWidth={2} aria-hidden />
      <span className="text-[12px]">{t("pricingComparison.states.excluded")}</span>
    </span>
  );
}

function PlanColumnHeader({ plan, t, lang, highlight }) {
  const price = formatPlanPrice(plan, lang);

  return (
    <div
      className={[
        "text-center px-3 py-5 rounded-t-2xl",
        highlight
          ? "bg-[#0A0A0B] text-white"
          : "bg-[#FAFAFA] text-[#0A0A0B] border-x border-t border-[#E7E9EE]",
      ].join(" ")}
    >
      {highlight ? (
        <div className="mb-2 flex justify-center">
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold text-white bg-gradient-to-r from-[#4F46E5] to-[#0EA5E9]">
            <Star className="w-2.5 h-2.5 fill-current" aria-hidden />
            {t("pricing.most")}
          </span>
        </div>
      ) : (
        <div className="h-[22px]" aria-hidden />
      )}
      <p className={`font-display text-lg font-bold tracking-tight ${highlight ? "text-white" : ""}`}>
        {planName(t, plan.id)}
      </p>
      <p className={`mt-1 text-sm tabular-nums ${highlight ? "text-white/70" : "text-[#52535E]"}`}>
        {price}€{t("pricing.per")}
      </p>
    </div>
  );
}

function DesktopComparison({ t, lang }) {
  return (
    <div
      className="hidden lg:grid lg:grid-cols-[minmax(220px,1.15fr)_repeat(3,minmax(0,1fr))] gap-x-0 rounded-2xl border border-[#E7E9EE] overflow-hidden shadow-[0_1px_2px_rgba(10,10,11,0.04)]"
      data-testid="pricing-comparison-desktop"
    >
      <div className="bg-[#FAFAFA] border-b border-[#E7E9EE] px-5 py-5 flex items-end">
        <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#8A8F98]">
          {t("pricingComparison.featureColumn")}
        </span>
      </div>
      {PLAN_CATALOG.map((plan) => (
        <PlanColumnHeader key={plan.id} plan={plan} t={t} lang={lang} highlight={plan.popular} />
      ))}

      {PLAN_COMPARISON_SECTIONS.map((section, sectionIdx) => (
        <SectionBlockDesktop
          key={section.id}
          section={section}
          t={t}
          lang={lang}
          isLast={sectionIdx === PLAN_COMPARISON_SECTIONS.length - 1}
        />
      ))}
    </div>
  );
}

function SectionBlockDesktop({ section, t, lang, isLast }) {
  return (
    <>
      <div
        className={[
          "col-span-4 px-5 py-3 bg-white border-t border-[#F3F4F6]",
          isLast ? "" : "",
        ].join(" ")}
      >
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#4F46E5]">
          {t(`pricingComparison.categories.${section.id}`)}
        </p>
      </div>

      {section.rows.map((row, rowIdx) => {
        const isLastRow = isLast && rowIdx === section.rows.length - 1;
        return (
          <div key={row.id} className="contents">
            <div
              className={[
                "px-5 py-4 flex items-center bg-white border-t border-[#F3F4F6]",
                isLastRow ? "border-b-0" : "",
              ].join(" ")}
            >
              <span className="text-[14px] text-[#52535E] leading-snug">
                {t(`pricingComparison.rows.${row.id}`)}
              </span>
            </div>
            {PLAN_CATALOG.map((plan) => {
              const value = comparisonValueForPlan(row, plan.id, plan);
              const highlight = plan.popular;
              return (
                <div
                  key={`${row.id}-${plan.id}`}
                  className={[
                    "px-4 py-4 flex items-center justify-center text-center border-t border-[#F3F4F6]",
                    highlight
                      ? "bg-[#FAFBFF] border-x border-[#E0E7FF]"
                      : "bg-white border-x border-[#F3F4F6]",
                    isLastRow && !highlight ? "border-b border-[#E7E9EE]" : "",
                    isLastRow && highlight ? "border-b border-[#E0E7FF]" : "",
                  ].join(" ")}
                  data-testid={`comparison-${section.id}-${row.id}-${plan.id}`}
                >
                  <ComparisonCell value={value} t={t} lang={lang} rowId={row.id} />
                </div>
              );
            })}
          </div>
        );
      })}
    </>
  );
}

function MobileComparison({ t, lang }) {
  const [openId, setOpenId] = useState(PLAN_COMPARISON_SECTIONS[0]?.id);

  return (
    <div className="lg:hidden space-y-3" data-testid="pricing-comparison-mobile">
      {PLAN_COMPARISON_SECTIONS.map((section) => {
        const isOpen = openId === section.id;
        return (
          <div
            key={section.id}
            className="rounded-2xl border border-[#E7E9EE] bg-white overflow-hidden shadow-[0_1px_2px_rgba(10,10,11,0.04)]"
          >
            <button
              type="button"
              className="w-full flex items-center justify-between gap-3 px-4 py-4 text-left"
              onClick={() => setOpenId(isOpen ? null : section.id)}
              aria-expanded={isOpen}
              data-testid={`comparison-accordion-${section.id}`}
            >
              <span className="text-[13px] font-bold uppercase tracking-[0.12em] text-[#4F46E5]">
                {t(`pricingComparison.categories.${section.id}`)}
              </span>
              <ChevronDown
                className={`w-4 h-4 text-[#8A8F98] transition-transform ${isOpen ? "rotate-180" : ""}`}
              />
            </button>

            {isOpen ? (
              <div className="px-4 pb-4 space-y-4 border-t border-[#F3F4F6]">
                {section.rows.map((row) => (
                  <div key={row.id} className="pt-4 first:pt-4">
                    <p className="text-[14px] font-medium text-[#0A0A0B] mb-3">
                      {t(`pricingComparison.rows.${row.id}`)}
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      {PLAN_CATALOG.map((plan) => {
                        const value = comparisonValueForPlan(row, plan.id, plan);
                        const highlight = plan.popular;
                        return (
                          <div
                            key={plan.id}
                            className={[
                              "rounded-xl px-3 py-3 text-center",
                              highlight
                                ? "bg-[#0A0A0B] text-white ring-1 ring-[#4F46E5]/30"
                                : "bg-[#FAFAFA] border border-[#E7E9EE]",
                            ].join(" ")}
                            data-testid={`comparison-mobile-${section.id}-${row.id}-${plan.id}`}
                          >
                            <p
                              className={`text-[10px] font-bold uppercase tracking-wide mb-2 ${highlight ? "text-white/60" : "text-[#9CA3AF]"}`}
                            >
                              {planName(t, plan.id)}
                            </p>
                            <div className="flex justify-center">
                              <ComparisonCell
                                value={value}
                                t={t}
                                lang={lang}
                                rowId={row.id}
                                inverted={highlight}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

export function PricingComparison({ onJoin }) {
  const { t, lang } = useLang();

  return (
    <section
      id="pricing-comparison"
      className="py-20 md:py-28 bg-[#FAFAFA] border-t border-[#F0F1F4]"
      data-testid="pricing-comparison-section"
    >
      <div className="max-w-7xl mx-auto px-6 md:px-10">
        <div className="text-center max-w-2xl mx-auto mb-12 md:mb-14">
          <h2 className="font-display text-[32px] md:text-[44px] font-black text-[#0A0A0B] tracking-[-0.03em] leading-[1.05]">
            {t("pricingComparison.title")}
          </h2>
          <p className="mt-4 text-[#52535E] text-base md:text-[17px] leading-relaxed">
            {t("pricingComparison.subtitle")}
          </p>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4 }}
        >
          <DesktopComparison t={t} lang={lang} />
          <MobileComparison t={t} lang={lang} />
        </motion.div>

        <div className="mt-12 md:mt-14 text-center">
          <button
            type="button"
            onClick={onJoin}
            data-testid="pricing-comparison-cta"
            className="group inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-xl bg-[#0A0A0B] text-white font-semibold text-[15px] tracking-tight hover:bg-[#22222A] transition-colors shadow-[0_1px_0_rgba(255,255,255,0.08)_inset,0_10px_20px_-12px_rgba(10,10,11,0.5)]"
          >
            {t("pricingComparison.cta")}
            <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
          </button>
        </div>
      </div>
    </section>
  );
}

export default PricingComparison;
