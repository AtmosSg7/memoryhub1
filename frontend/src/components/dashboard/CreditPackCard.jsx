import { Sparkles, Loader2 } from "lucide-react";
import { useDashboardLang } from "@/hooks/useDashboardLang";
import { ActionButton } from "@/components/dashboard/ActionButton";

function formatPrice(priceCents, currency, lang) {
  const amount = priceCents / 100;
  try {
    return new Intl.NumberFormat(lang === "fr" ? "fr-FR" : "en-GB", {
      style: "currency",
      currency: currency.toUpperCase(),
    }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency.toUpperCase()}`;
  }
}

export default function CreditPackCard({
  pack,
  loading = false,
  devMode = false,
  onPurchase,
  disabled = false,
}) {
  const { t, lang } = useDashboardLang();
  const priceLabel = formatPrice(pack.priceCents, pack.currency, lang);
  const perAnalysis =
    pack.analyses > 0 ? (pack.priceCents / 100 / pack.analyses).toFixed(2) : null;

  return (
    <div
      className="rounded-xl border border-white/15 bg-white/5 p-4 flex flex-col gap-3 min-h-[180px]"
      data-testid={`analysis-pack-${pack.packKey}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-white">{pack.name}</p>
          <p className="text-2xl font-cabinet font-bold text-white mt-1 tabular-nums">
            {pack.analyses.toLocaleString(lang === "fr" ? "fr-FR" : "en-GB")}
            <span className="text-sm font-normal text-white/60 ml-1">{t("credits.short")}</span>
          </p>
        </div>
        <div className="rounded-lg bg-white/10 p-2">
          <Sparkles className="w-4 h-4 text-[#7BB8FF]" />
        </div>
      </div>

      <div className="mt-auto space-y-2">
        <p className="text-lg font-semibold text-white tabular-nums">{priceLabel}</p>
        {perAnalysis ? (
          <p className="text-[11px] text-white/50">
            {t("creditPacks.perAnalysis").replace("{value}", perAnalysis)}
          </p>
        ) : null}

        <ActionButton
          variant="secondary"
          className="w-full justify-center bg-white text-[#0A2540] hover:bg-white/90 border-0"
          disabled={disabled || loading || (!devMode && !pack.stripeConfigured)}
          onClick={() => onPurchase?.(pack)}
          data-testid={`analysis-pack-buy-${pack.packKey}`}
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
          {devMode ? t("creditPacks.devBuy") : t("creditPacks.buy")}
        </ActionButton>
      </div>
    </div>
  );
}
