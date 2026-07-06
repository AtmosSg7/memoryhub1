import { CheckCircle2 } from "lucide-react";

export default function QuoteAcceptedBanner({ quote, t }) {
  if (!quote || quote.status !== "accepted" || quote.invoiceId) return null;

  const message = quote.portalAcceptedAt
    ? t("commercialDetail.quoteAcceptedViaPortal")
    : t("commercialDetail.quoteAcceptedReady");

  return (
    <div
      className="rounded-xl border border-[#A7F3D0] bg-[#ECFDF5] px-4 py-3 flex items-start gap-3"
      data-testid="quote-accepted-banner"
    >
      <CheckCircle2 className="w-5 h-5 text-[#065F46] shrink-0 mt-0.5" />
      <p className="text-sm text-[#065F46]">{message}</p>
    </div>
  );
}
