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
      className="dash-badge dash-badge-warning"
      data-testid="demo-data-badge"
    >
      {t("demoData.badge")}
    </span>
  );
}

export default memo(DemoDataBadge);
