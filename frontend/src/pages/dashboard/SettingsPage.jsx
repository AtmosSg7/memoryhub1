import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useDashboardLang } from "@/hooks/useDashboardLang";
import { usePageTitle } from "@/hooks/usePageTitle";
import { useAuth } from "@/context/AuthContext";
import PageHeader from "@/components/dashboard/PageHeader";
import SettingsShell from "@/components/dashboard/SettingsShell";
import CreditBalanceBadge from "@/components/dashboard/CreditBalanceBadge";
import BetaFeedbackDialog from "@/components/dashboard/BetaFeedbackDialog";
import AppearanceSettings from "@/components/dashboard/AppearanceSettings";
import { FORM_LABEL_CLASS, FORM_READONLY_FIELD_CLASS } from "@/components/dashboard/detailModalLayout";

export default function SettingsPage() {
  const { t, lang, setLang } = useDashboardLang();
  usePageTitle("page.settings.title");
  const { user } = useAuth();
  const navigate = useNavigate();
  const [feedbackOpen, setFeedbackOpen] = useState(false);

  const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(" ") || "—";

  return (
    <div className="space-y-6" data-testid="settings-page">
      <PageHeader
        title={t("page.settings.title")}
        subtitle={t("page.settings.subtitle")}
        testId="settings-header"
      />

      <SettingsShell activeKey="profile">
        <SettingsShell.Section title={t("settingsForm.profileSection")}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label={t("settingsForm.fullName")} value={fullName} />
            <Field label={t("settingsForm.email")} value={user?.email || ""} />
            <Field label={t("settingsForm.company")} value={user?.companyName || ""} />
            <Field label={t("settingsForm.role")} value={t("settingsForm.roleOwner")} />
          </div>
        </SettingsShell.Section>

        <SettingsShell.Section title={t("imports.label")}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CreditBalanceBadge linkTo="/dashboard/billing" />
            <button
              type="button"
              onClick={() => navigate("/dashboard/billing/ai-history")}
              className="text-sm font-medium text-dash-primary hover:underline"
            >
              {t("credits.historyViewAll")}
            </button>
          </div>
        </SettingsShell.Section>

        <SettingsShell.Section title={t("appearance.section")} testId="settings-appearance-section">
          <AppearanceSettings />
        </SettingsShell.Section>

        <SettingsShell.Section title={t("settingsForm.preferencesSection")}>
          <Row label={t("settingsForm.interfaceLanguage")}>
            <div className="flex items-center bg-dash-surface-muted rounded-lg p-0.5">
              {["fr", "en"].map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setLang(c)}
                  data-testid={`settings-lang-${c}`}
                  className={[
                    "px-2.5 py-1 text-[11px] uppercase font-semibold rounded-md transition-all",
                    lang === c ? "bg-dash-surface text-dash-primary shadow-sm" : "text-dash-text-muted",
                  ].join(" ")}
                >
                  {c}
                </button>
              ))}
            </div>
          </Row>
          <Row label={t("betaFeedback.title")}>
            <button
              type="button"
              onClick={() => setFeedbackOpen(true)}
              className="text-sm font-medium text-dash-primary hover:underline"
              data-testid="settings-feedback-btn"
            >
              {t("topbar.menu.feedback")}
            </button>
          </Row>
        </SettingsShell.Section>
      </SettingsShell>
      <BetaFeedbackDialog open={feedbackOpen} onOpenChange={setFeedbackOpen} />
    </div>
  );
}

const Field = ({ label, value }) => (
  <label className="block">
    <span className={FORM_LABEL_CLASS}>{label}</span>
    <input
      defaultValue={value}
      readOnly
      className={`mt-1.5 w-full ${FORM_READONLY_FIELD_CLASS}`}
    />
  </label>
);

const Row = ({ label, children }) => (
  <div className="flex items-center justify-between gap-4 py-2">
    <span className="text-sm text-dash-text">{label}</span>
    {children}
  </div>
);
