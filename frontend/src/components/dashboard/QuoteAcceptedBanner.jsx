import { CheckCircle2 } from "lucide-react";

export default function QuoteAcceptedBanner({ quote, t }) {
  if (!quote || quote.status !== "accepted" || quote.invoiceId) return null;

  return (
    <div
      className="rounded-xl border border-[var(--dash-success-border)] bg-[var(--dash-success-bg)] px-4 py-3 flex items-start gap-3 text-[color:var(--dash-success-text)]"
      data-testid="quote-accepted-banner"
    >
      <CheckCircle2 className="w-5 h-5 text-[#065F46] shrink-0 mt-0.5" />
      <p className="text-sm text-[#065F46]">{t("commercialDetail.quoteAcceptedReady")}</p>
    </div>
  );
}
