import { Info } from "lucide-react";

export default function CommercialDocumentsInfoBanner({ t }) {
  return (
    <div
      className="flex items-start gap-3 rounded-xl bg-dash-bg px-4 py-3 ring-1 ring-[#E5E7EB]/60"
      data-testid="commercial-documents-info-banner"
    >
      <Info className="mt-0.5 h-4 w-4 shrink-0 text-dash-text-subtle" aria-hidden />
      <p className="text-sm text-dash-text-muted leading-relaxed">{t("commercialDocuments.infoBanner")}</p>
    </div>
  );
}
