import React from "react";
import { useLang } from "@/context/LanguageContext";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

export const Faq = () => {
  const { t } = useLang();
  const items = t("faq.items");

  return (
    <section id="faq" className="py-24 md:py-32 bg-[#FAFAFB] border-y border-[#E5E7EB]">
      <div className="max-w-3xl mx-auto px-6 md:px-10">
        <div className="mb-12">
          <p className="text-[12px] uppercase tracking-[0.18em] text-[#4F46E5] font-bold mb-3">
            {t("faq.kicker")}
          </p>
          <h2 className="font-display text-4xl md:text-5xl font-black text-[#0A0A0B] tracking-tight leading-[1.02]">
            {t("faq.title")}
          </h2>
        </div>

        <Accordion type="single" collapsible className="w-full space-y-3" data-testid="faq-accordion">
          {items.map((item, idx) => (
            <AccordionItem
              key={idx}
              value={`item-${idx}`}
              className="card-soft px-5 border !border-[#E5E7EB]"
              data-testid={`faq-item-${idx}`}
            >
              <AccordionTrigger className="text-left font-display font-bold text-[16px] md:text-[17px] text-[#0A0A0B] hover:no-underline">
                {item.q}
              </AccordionTrigger>
              <AccordionContent className="text-[14.5px] text-[#5E5F6E] leading-relaxed pb-4">
                {item.a}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
};
