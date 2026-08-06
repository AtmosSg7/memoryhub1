import { Users, Upload } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useDashboardLang } from "@/hooks/useDashboardLang";
import { useAddClient } from "@/context/AddClientContext";
import { ActionButton } from "@/components/dashboard/ActionButton";

const STEPS = [
  { key: "client", icon: Users, variant: "primary" },
  { key: "import", icon: Upload, variant: "primary" },
];

export default function OnboardingCards({ onboarding, compact = false }) {
  const { t } = useDashboardLang();
  const navigate = useNavigate();
  const { openAddClient } = useAddClient();

  const visibleSteps = STEPS.filter(({ key }) => {
    if (key === "client") return onboarding.needsClient;
    if (key === "import") return onboarding.needsImport;
    return false;
  });

  if (visibleSteps.length === 0) return null;

  const handlers = {
    client: openAddClient,
    import: () => navigate("/dashboard/documents?import=1"),
  };

  if (compact) {
    return (
      <section
        className="rounded-xl border border-[#DBEAFE] bg-[#F8FBFF] px-4 py-3"
        data-testid="dashboard-onboarding"
      >
        <p className="text-xs font-medium text-[#1E40AF] mb-2">{t("onboarding.progressSubtitle")}</p>
        <div className="flex flex-wrap gap-2">
          {visibleSteps.map(({ key, icon: Icon, variant }) => (
            <ActionButton
              key={key}
              variant={variant}
              onClick={handlers[key]}
              className="gap-1.5 h-8 text-xs"
              data-testid={`onboarding-step-${key}`}
            >
              <Icon className="w-3.5 h-3.5" />
              {t(`onboarding.steps.${key}.cta`)}
            </ActionButton>
          ))}
        </div>
      </section>
    );
  }

  return (
    <section
      className="rounded-2xl border border-[#DBEAFE] bg-gradient-to-br from-dash-accent-soft to-white p-6 md:p-8"
      data-testid="dashboard-onboarding"
    >
      <h2 className="font-cabinet text-xl md:text-2xl font-bold text-dash-text tracking-tight">
        {t("onboarding.title")}
      </h2>
      <p className="text-sm text-dash-text-muted mt-2 max-w-xl">{t("onboarding.subtitle")}</p>

      <div
        className={[
          "grid gap-3 mt-6",
          visibleSteps.length === 1 ? "grid-cols-1 max-w-sm" : "grid-cols-1 md:grid-cols-2",
        ].join(" ")}
      >
        {visibleSteps.map(({ key, icon: Icon, variant }, index) => (
          <div
            key={key}
            className="rounded-xl border border-dash-border bg-dash-surface p-4 flex flex-col gap-3"
            data-testid={`onboarding-step-${key}`}
          >
            <div className="flex items-center gap-2">
              <span className="w-7 h-7 rounded-full bg-[var(--dash-nav-active-bg)] text-white text-xs font-bold flex items-center justify-center">
                {index + 1}
              </span>
              <Icon className="w-4 h-4 text-dash-primary" strokeWidth={1.75} />
              <span className="font-medium text-sm text-dash-text">
                {t(`onboarding.steps.${key}.title`)}
              </span>
            </div>
            <p className="text-xs text-dash-text-muted leading-relaxed flex-1">
              {t(`onboarding.steps.${key}.desc`)}
            </p>
            <ActionButton
              variant={variant}
              onClick={handlers[key]}
              className="w-full"
              data-testid={`onboarding-step-${key}-cta`}
            >
              {t(`onboarding.steps.${key}.cta`)}
            </ActionButton>
          </div>
        ))}
      </div>
    </section>
  );
}
