import { useDashboardLang } from "@/hooks/useDashboardLang";
import { ActionButton } from "@/components/dashboard/ActionButton";

export default function NeedsClientBanner({ onCreateClient, testId = "needs-client-banner" }) {
  const { t } = useDashboardLang();

  return (
    <div
      data-testid={testId}
      className="rounded-xl border border-[#FDE68A] bg-[#FFFBEB] p-5 space-y-4"
    >
      <div>
        <p className="font-cabinet text-[15px] font-semibold text-[#92400E]">{t("empty.needsClient.title")}</p>
        <p className="text-sm text-[#92400E]/90 mt-1 leading-relaxed">{t("empty.needsClient.hint")}</p>
      </div>
      <ActionButton variant="primary" onClick={onCreateClient} data-testid={`${testId}-cta`}>
        {t("empty.noClients.cta")}
      </ActionButton>
    </div>
  );
}
