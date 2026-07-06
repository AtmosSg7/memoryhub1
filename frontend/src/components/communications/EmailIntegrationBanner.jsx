import { Plug } from "lucide-react";
import { useDashboardLang } from "@/hooks/useDashboardLang";

export default function EmailIntegrationBanner() {
  const { t } = useDashboardLang();

  return (
    <div
      className="rounded-xl border border-dashed border-[#C7D2FE] bg-[#F5F3FF] px-4 py-4 flex items-start gap-3"
      data-testid="email-integration-banner"
    >
      <div className="w-10 h-10 rounded-xl bg-white border border-[#DDD6FE] flex items-center justify-center shrink-0">
        <Plug className="w-5 h-5 text-[#5B21B6]" />
      </div>
      <div>
        <p className="font-cabinet text-sm font-bold text-[#111827]">{t("communications.emailBanner.title")}</p>
        <p className="text-xs text-[#6B7280] mt-1">{t("communications.emailBanner.desc")}</p>
      </div>
    </div>
  );
}
