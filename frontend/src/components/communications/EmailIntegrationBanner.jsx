import { Plug } from "lucide-react";
import { useDashboardLang } from "@/hooks/useDashboardLang";

export default function EmailIntegrationBanner() {
  const { t } = useDashboardLang();

  return (
    <p
      className="text-xs text-[#6B7280] rounded-lg border border-dashed border-[#E5E7EB] bg-[#FAFAFA] px-3 py-2 flex items-center gap-2"
      data-testid="email-integration-banner"
    >
      <Plug className="w-3.5 h-3.5 text-[#9CA3AF] shrink-0" aria-hidden="true" />
      <span>{t("communications.emailBanner.desc")}</span>
    </p>
  );
}
