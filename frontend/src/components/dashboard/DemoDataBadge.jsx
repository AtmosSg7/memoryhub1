import { memo } from "react";
import { useDemoDataStatus } from "@/hooks/useDemoDataStatus";
import { useDashboardLang } from "@/hooks/useDashboardLang";

/**
 * Tiny local-only badge when the account contains seeded demo data.
 * Hidden in production (endpoint not registered when deployed).
 */
function DemoDataBadge() {
  const { t } = useDashboardLang();
  const { hasDemoData } = useDemoDataStatus();

  if (!hasDemoData) return null;

  return (
    <span
      className="inline-flex items-center rounded-md border border-[#FDE68A] bg-[#FFFBEB] px-2 py-0.5 text-[11px] font-medium text-[#92400E]"
      data-testid="demo-data-badge"
    >
      {t("demoData.badge")}
    </span>
  );
}

export default memo(DemoDataBadge);
