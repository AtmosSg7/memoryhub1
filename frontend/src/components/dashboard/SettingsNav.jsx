import { useNavigate } from "react-router-dom";
import { useDashboardLang } from "@/hooks/useDashboardLang";

export const SETTINGS_NAV_ITEMS = [
  { key: "profile", path: "/dashboard/settings" },
  { key: "company", path: "/dashboard/settings/company" },
  { key: "integrations", path: "/dashboard/integrations" },
  { key: "billing", path: "/dashboard/billing" },
];

export default function SettingsNav({ activeKey, testId = "settings-nav" }) {
  const { t } = useDashboardLang();
  const navigate = useNavigate();

  return (
    <nav className="space-y-1 text-sm" data-testid={testId} aria-label={t("page.settings.title")}>
      {SETTINGS_NAV_ITEMS.map((item, index) => {
        const isActive = item.key === activeKey;

        return (
          <button
            key={item.key}
            type="button"
            onClick={() => navigate(item.path)}
            data-testid={`settings-tab-${index}`}
            aria-current={isActive ? "page" : undefined}
            className={[
              "w-full text-left px-3 py-2.5 rounded-xl transition-colors",
              isActive
                ? "bg-[var(--dash-nav-active-bg)] text-[var(--dash-nav-active-text)] font-medium shadow-sm"
                : "text-dash-text-muted hover:bg-dash-surface-muted",
            ].join(" ")}
          >
            {t(`settingsForm.nav.${item.key}`)}
          </button>
        );
      })}
    </nav>
  );
}
