import React from "react";
import { Link } from "react-router-dom";
import { useLang } from "@/context/LanguageContext";
import { ShowcaseApp } from "@/showcase/ShowcaseApp";

/**
 * Homepage interactive product demo — real Basera UI, showcase data only.
 */
export function ProductShowcase() {
  const { t, lang } = useLang();

  return (
    <section
      id="demo"
      className="relative py-16 md:py-24 px-4 md:px-6 overflow-hidden"
      aria-label={t("showcase.ariaLabel")}
      data-testid="product-showcase"
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.55]"
        aria-hidden="true"
        style={{
          background:
            "radial-gradient(ellipse 80% 50% at 50% 0%, color-mix(in srgb, var(--dash-accent, #0F766E) 12%, transparent), transparent 70%)",
        }}
      />

      <div className="relative mx-auto max-w-[88rem] w-full">
        <div className="max-w-2xl mb-8 md:mb-10 px-1">
          <p className="font-cabinet text-[12px] uppercase tracking-[0.14em] text-dash-text-subtle mb-3">
            {t("showcase.kicker")}
          </p>
          <h2 className="font-cabinet text-[1.85rem] md:text-[2.35rem] leading-[1.15] tracking-tight text-dash-text">
            {t("showcase.title")}
          </h2>
          <p className="mt-3 text-[15px] md:text-[16px] leading-relaxed text-dash-text-muted max-w-xl">
            {t("showcase.subtitle")}
          </p>
        </div>

        <div
          className="relative rounded-2xl border border-dash-border bg-dash-surface shadow-[0_28px_90px_-40px_rgba(15,23,42,0.5)] overflow-hidden"
          data-testid="showcase-window"
        >
          <div className="flex items-center gap-2 border-b border-dash-border-soft bg-dash-surface-muted/80 px-3.5 py-2.5">
            <span className="flex gap-1.5" aria-hidden="true">
              <span className="h-2.5 w-2.5 rounded-full bg-[#E5E7EB]" />
              <span className="h-2.5 w-2.5 rounded-full bg-[#E5E7EB]" />
              <span className="h-2.5 w-2.5 rounded-full bg-[#E5E7EB]" />
            </span>
            <span className="ml-1 truncate text-[11px] text-dash-text-subtle font-medium">
              {t("search.demo.windowTitle")}
            </span>
            <span className="ml-auto hidden sm:inline text-[10px] uppercase tracking-wide text-dash-text-subtle">
              {t("showcase.demoBadge")}
            </span>
          </div>

          {/*
            Fixed-height frame: no outer scroll. Sidebar/topbar stay put;
            only dashboard-main scrolls inside ShowcaseApp.
          */}
          <div
            className="relative h-[min(84vh,760px)] overflow-hidden overscroll-none bg-dash-bg [transform:translateZ(0)] isolate"
            data-testid="showcase-viewport"
          >
            <ShowcaseApp lang={lang} />
          </div>
        </div>

        <div className="mt-8 md:mt-10 flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6 px-1">
          <Link
            to="/register"
            className="inline-flex items-center justify-center rounded-xl bg-[var(--dash-cta,#0A0A0B)] px-5 py-3 text-[14px] font-medium text-[var(--dash-cta-text,#fff)] transition hover:opacity-90"
            data-testid="showcase-cta"
          >
            {t("showcase.conclusion.cta")}
          </Link>
          <p className="text-[13px] text-dash-text-muted max-w-md">{t("showcase.ctaHint")}</p>
        </div>
      </div>
    </section>
  );
}
