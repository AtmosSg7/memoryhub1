import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CheckCircle2, FileUp, Search, Sparkles, Users, Mail, Contact } from "lucide-react";
import { useDashboardLang } from "@/hooks/useDashboardLang";
import { useAddClient } from "@/context/AddClientContext";
import { ActionButton } from "@/components/dashboard/ActionButton";

const BENEFITS = ["findInfo", "followAll", "knowToday"];

const SOURCE_OPTIONS = [
  { id: "client", icon: Users, requiresDemo: false },
  { id: "import", icon: FileUp, requiresDemo: false },
  { id: "contacts", icon: Contact, requiresDemo: false },
  { id: "gmail", icon: Mail, requiresDemo: false },
  { id: "demo", icon: Sparkles, requiresDemo: true },
];

/**
 * 4-step onboarding wizard for empty accounts.
 * Steps: welcome → first source → first win hint → dashboard tour.
 */
export default function OnboardingWizard({
  open,
  demoAllowed = false,
  currentStep = 0,
  onStepChange,
  onComplete,
  onDismiss,
}) {
  const { t } = useDashboardLang();
  const navigate = useNavigate();
  const { openAddClient } = useAddClient();
  const [step, setStep] = useState(currentStep || 0);

  useEffect(() => {
    if (open) setStep(Math.min(Math.max(currentStep || 0, 0), 3));
  }, [open, currentStep]);

  if (!open) return null;

  const go = async (next) => {
    setStep(next);
    if (onStepChange) await onStepChange(next);
  };

  const finish = async () => {
    if (onComplete) await onComplete();
  };

  const handleSource = async (id) => {
    if (id === "client") openAddClient();
    if (id === "import") navigate("/dashboard/files?import=1");
    if (id === "contacts" || id === "gmail") navigate("/dashboard/integrations");
    if (id === "demo") navigate("/dashboard");
    await go(2);
  };

  const sources = SOURCE_OPTIONS.filter((s) => !s.requiresDemo || demoAllowed);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-[#0A2540]/55 p-3 sm:p-6"
      data-testid="onboarding-wizard"
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboarding-wizard-title"
    >
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl border border-[#E5E7EB] overflow-hidden">
        <div className="px-5 pt-5 pb-3 border-b border-[#F3F4F6] flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[#6B7280]">
              {t("onboardingWizard.progress").replace("{step}", String(step + 1)).replace("{total}", "4")}
            </p>
            <h2 id="onboarding-wizard-title" className="font-cabinet text-xl font-bold text-[#111827] mt-1">
              {t(`onboardingWizard.steps.${step}.title`)}
            </h2>
          </div>
          <button
            type="button"
            onClick={onDismiss}
            className="text-xs text-[#6B7280] hover:text-[#111827] px-2 py-1 rounded-md hover:bg-[#F3F4F6]"
            data-testid="onboarding-wizard-skip"
          >
            {t("onboardingWizard.skip")}
          </button>
        </div>

        <div className="px-5 py-5 space-y-4">
          {step === 0 ? (
            <>
              <p className="text-sm text-[#374151] leading-relaxed">{t("onboardingWizard.welcome.message")}</p>
              <ul className="space-y-2">
                {BENEFITS.map((key) => (
                  <li key={key} className="flex items-start gap-2 text-sm text-[#4B5563]">
                    <CheckCircle2 className="w-4 h-4 text-[#0A2540] mt-0.5 shrink-0" />
                    <span>{t(`onboardingWizard.welcome.benefits.${key}`)}</span>
                  </li>
                ))}
              </ul>
            </>
          ) : null}

          {step === 1 ? (
            <>
              <p className="text-sm text-[#4B5563]">{t("onboardingWizard.source.subtitle")}</p>
              <div className="grid gap-2">
                {sources.map(({ id, icon: Icon }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => handleSource(id)}
                    className="flex items-center gap-3 rounded-xl border border-[#E5E7EB] bg-[#FAFAFA] hover:bg-[#F3F4F6] px-3 py-3 text-left transition-colors"
                    data-testid={`onboarding-source-${id}`}
                  >
                    <span className="w-9 h-9 rounded-lg bg-white border border-[#E5E7EB] flex items-center justify-center shrink-0">
                      <Icon className="w-4 h-4 text-[#0A2540]" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-[#111827]">
                        {t(`onboardingWizard.source.options.${id}.title`)}
                      </span>
                      <span className="block text-xs text-[#6B7280] mt-0.5">
                        {t(`onboardingWizard.source.options.${id}.desc`)}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            </>
          ) : null}

          {step === 2 ? (
            <div className="rounded-xl border border-[#DBEAFE] bg-[#F8FBFF] px-4 py-4 space-y-2">
              <div className="flex items-center gap-2 text-[#1E40AF]">
                <CheckCircle2 className="w-5 h-5" />
                <p className="text-sm font-semibold">{t("onboardingWizard.firstWin.title")}</p>
              </div>
              <p className="text-sm text-[#374151] leading-relaxed">{t("onboardingWizard.firstWin.body")}</p>
            </div>
          ) : null}

          {step === 3 ? (
            <ul className="space-y-3">
              {["kpis", "actions", "analytics", "search"].map((key) => (
                <li key={key} className="flex items-start gap-2.5">
                  <Search className="w-4 h-4 text-[#0A2540] mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-[#111827]">
                      {t(`onboardingWizard.dashboard.${key}.title`)}
                    </p>
                    <p className="text-xs text-[#6B7280] mt-0.5">
                      {t(`onboardingWizard.dashboard.${key}.desc`)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        <div className="px-5 py-4 border-t border-[#F3F4F6] flex items-center justify-between gap-3">
          {step > 0 ? (
            <button
              type="button"
              onClick={() => go(step - 1)}
              className="text-sm text-[#6B7280] hover:text-[#111827]"
            >
              {t("onboardingWizard.back")}
            </button>
          ) : (
            <span />
          )}
          {step === 0 ? (
            <ActionButton variant="primary" onClick={() => go(1)} data-testid="onboarding-wizard-next">
              {t("onboardingWizard.next")}
            </ActionButton>
          ) : null}
          {step === 2 ? (
            <ActionButton variant="primary" onClick={() => go(3)} data-testid="onboarding-wizard-next">
              {t("onboardingWizard.next")}
            </ActionButton>
          ) : null}
          {step === 3 ? (
            <ActionButton variant="primary" onClick={finish} data-testid="onboarding-wizard-finish">
              {t("onboardingWizard.finish")}
            </ActionButton>
          ) : null}
        </div>
      </div>
    </div>
  );
}
