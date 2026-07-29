import { Sparkles } from "lucide-react";
import { useDashboardLang } from "@/hooks/useDashboardLang";
import CreditPackCard from "@/components/dashboard/CreditPackCard";

export default function AiAnalysisPacksPanel({
  packs = [],
  packCaps = {},
  actionLoading = null,
  disabled = false,
  onPurchase,
}) {
  const { t } = useDashboardLang();
  const checkoutEnabled = packCaps.devCreditPurchasesEnabled || packCaps.stripeCreditCheckoutEnabled;
  const previewMode = !checkoutEnabled;

  return (
    <section
      className="rounded-2xl border border-[#E5E7EB] bg-gradient-to-br from-[#0A2540] to-[#173A5E] p-5 md:p-6 text-white"
      data-testid="ai-analysis-packs-panel"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="w-4 h-4 text-[#7BB8FF]" />
            <span className="text-[11px] uppercase tracking-widest text-white/70 font-semibold">
              {t("creditPacks.badge")}
            </span>
          </div>
          <h2 className="font-cabinet text-xl md:text-2xl font-bold tracking-tight">{t("creditPacks.title")}</h2>
          <p className="text-sm text-white/75 mt-2 max-w-2xl leading-relaxed">{t("creditPacks.subtitle")}</p>
        </div>
        {previewMode ? (
          <span className="shrink-0 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-white/80">
            {t("creditPacks.previewBadge")}
          </span>
        ) : null}
      </div>

      {previewMode ? (
        <p className="mt-4 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/80 leading-relaxed">
          {t("creditPacks.previewHint")}
        </p>
      ) : null}

      {packCaps.devCreditPurchasesEnabled ? (
        <p className="text-xs text-[#7BB8FF] mt-3">{t("creditPacks.devHint")}</p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 mt-5">
        {packs.map((pack) => (
          <CreditPackCard
            key={pack.packKey}
            pack={pack}
            devMode={packCaps.devCreditPurchasesEnabled}
            loading={actionLoading === `pack-${pack.packKey}`}
            disabled={disabled || previewMode}
            onPurchase={onPurchase}
          />
        ))}
      </div>
    </section>
  );
}
