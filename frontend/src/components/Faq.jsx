import React from "react";
import { useLang } from "@/context/LanguageContext";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

export const Faq = () => {
  const { t } = useLang();
  const items = t("faq.items");

  return (
    <section id="faq" className="py-28 md:py-36 bg-gradient-to-b from-[#FBFBFC] via-[#F4F5F7] to-[#FBFBFC] border-y border-[#EEF0F3]">
      <div className="max-w-3xl mx-auto px-6 md:px-10">
        <div className="mb-14">
          <p className="text-[11px] uppercase tracking-[0.2em] text-[#4F46E5] font-bold mb-4">
            {t("faq.kicker")}
          </p>
          <h2 className="font-display text-[36px] md:text-[52px] font-black text-[#0A0A0B] tracking-[-0.03em] leading-[1.02]">
            {t("faq.title")}
          </h2>
        </div>

        <Accordion type="single" collapsible className="w-full space-y-3" data-testid="faq-accordion">
          {items.map((item, idx) => (
            <AccordionItem
              key={idx}
              value={`item-${idx}`}
              className="card-soft px-5 md:px-6 border !border-[#E7E9EE] data-[state=open]:border-[#D6DAE1] data-[state=open]:shadow-[0_1px_0_rgba(255,255,255,0.7)_inset,0_2px_4px_rgba(10,10,11,0.04),0_20px_40px_-24px_rgba(10,10,11,0.14)] transition-all duration-500"
              data-testid={`faq-item-${idx}`}
            >
              <AccordionTrigger className="text-left font-display font-bold text-[16px] md:text-[17.5px] text-[#0A0A0B] hover:no-underline tracking-[-0.02em] py-5 [&[data-state=open]>svg]:text-[#4F46E5]">
                {item.q}
              </AccordionTrigger>
              <AccordionContent className="text-[14.5px] text-[#52535E] leading-[1.65] pb-5 pr-6">
                {item.a}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
};
