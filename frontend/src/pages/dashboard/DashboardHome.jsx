import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useDashboardLang } from "@/hooks/useDashboardLang";
import { useLivingDashboard } from "@/hooks/useLivingDashboard";
import { useOnboardingState } from "@/hooks/useOnboardingState";
import { usePageTitle } from "@/hooks/usePageTitle";
import { useAuth } from "@/context/AuthContext";
import DashboardHeader from "@/components/dashboard/DashboardHeader";
import DashboardQuickActions from "@/components/dashboard/DashboardQuickActions";
import DashboardActionCenterCard from "@/components/dashboard/DashboardActionCenterCard";
import TopClients from "@/components/dashboard/TopClients";
import OnboardingCards from "@/components/dashboard/OnboardingCards";
import OnboardingWizard from "@/components/dashboard/OnboardingWizard";
import StartupChecklist from "@/components/dashboard/StartupChecklist";
import ActivityFeed from "@/components/dashboard/ActivityFeed";
import LivingKpiStrip from "@/components/dashboard/living/LivingKpiStrip";
import LivingTodayStrip from "@/components/dashboard/living/LivingTodayStrip";
import LivingMoneySection from "@/components/dashboard/living/LivingMoneySection";
import LivingCommunicationStats from "@/components/dashboard/living/LivingCommunicationStats";
import LivingRemindersSection from "@/components/dashboard/living/LivingRemindersSection";

export default function DashboardHome() {
  const { t, lang } = useDashboardLang();
  usePageTitle("page.dashboard.title");
  const { user } = useAuth();
  const navigate = useNavigate();
  const [period, setPeriod] = useState("30d");

  const {
    livingKpis,
    money,
    series,
    topClients,
    emptyAnalytics,
    loading: dataLoading,
    listsLoading,
    onboarding,
    isEmptyAccount,
    hasOnboardingSteps,
    todayEvents,
    pulseActions,
    pulseLoading,
    communicationStats,
    phoneStats,
    reminders,
    refetchAll,
  } = useLivingDashboard({ lang, period, enabled: true });

  const {
    state: onboardingState,
    showWizard,
    showChecklist,
    demoAllowed,
    patchWizard,
    dismissChecklist,
    ackFirstWin,
    pendingFirstWin,
    maturity,
    refresh: refreshOnboarding,
  } = useOnboardingState({ enabled: true });

  useEffect(() => {
    if (!pendingFirstWin) return;
    const message = t(`firstWins.${pendingFirstWin.id}`);
    toast.success(message, { duration: 4000 });
    ackFirstWin(pendingFirstWin.id).catch(() => {});
  }, [pendingFirstWin, ackFirstWin, t]);

  useEffect(() => {
    if (!isEmptyAccount && maturity === "empty") {
      refreshOnboarding();
    }
  }, [isEmptyAccount, maturity, refreshOnboarding]);

  const showEmptyHero = (isEmptyAccount || maturity === "empty") && !showWizard;
  const showFullDashboard = maturity === "active" || (!isEmptyAccount && !showEmptyHero);
  const firstName = user?.firstName?.trim();
  const showOnboardingGuidance =
    hasOnboardingSteps &&
    (pulseActions?.length || 0) === 0 &&
    !pulseLoading &&
    maturity !== "active";

  return (
    <div className="space-y-6 md:space-y-8 pb-8" data-testid="dashboard-home">
      <OnboardingWizard
        open={showWizard}
        demoAllowed={demoAllowed}
        currentStep={onboardingState?.wizard?.currentStep || 0}
        onStepChange={(step) => patchWizard({ currentStep: step })}
        onComplete={() => patchWizard({ completed: true, currentStep: 4 })}
        onDismiss={() => patchWizard({ dismissed: true })}
      />

      <div className="space-y-4">
        <DashboardHeader
          firstName={firstName}
          subtitle={t("livingDashboard.header.subtitle")}
        />
        {showChecklist ? (
          <StartupChecklist
            checklist={onboardingState?.checklist}
            onDismiss={() => dismissChecklist().catch(() => toast.error(t("errors.generic")))}
          />
        ) : null}
      </div>

      {showEmptyHero ? (
        <OnboardingCards onboarding={onboarding} />
      ) : showFullDashboard ? (
        <>
          <LivingKpiStrip kpis={livingKpis} loading={dataLoading || pulseLoading} t={t} />

          <div className="md:hidden">
            <DashboardQuickActions compact />
          </div>

          <LivingTodayStrip
            events={todayEvents}
            importsToday={livingKpis.importsToday}
            phoneToday={phoneStats?.today ?? 0}
            t={t}
          />

          <DashboardActionCenterCard
            actions={pulseActions}
            loading={pulseLoading}
            error={null}
            onboardingHint={showOnboardingGuidance}
            onChanged={refetchAll}
          />

          <LivingRemindersSection reminders={reminders} t={t} />

          <section className="space-y-2" data-testid="living-activity">
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-dash-text-subtle">
              {t("livingDashboard.activity.title")}
            </h2>
            <ActivityFeed
              limit={8}
              compact
              muted={false}
              showViewAll
              showHeader={false}
              showEmptyState
              viewAllPath="/dashboard/communications"
            />
          </section>

          <LivingMoneySection
            money={money}
            series={series}
            period={period}
            onPeriodChange={setPeriod}
            empty={emptyAnalytics}
            loading={listsLoading}
            t={t}
          />

          {(topClients?.length > 0 || dataLoading) && (
            <section className="space-y-2" data-testid="living-top-clients">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-dash-text-subtle">
                  {t("livingDashboard.topClients.title")}
                </h2>
                <button
                  type="button"
                  className="text-xs font-medium text-dash-primary"
                  onClick={() => navigate("/dashboard/clients")}
                >
                  {t("livingDashboard.seeAll")}
                </button>
              </div>
              <TopClients
                clients={topClients.slice(0, 5)}
                loading={dataLoading}
                variant="living"
                compact
              />
            </section>
          )}

          <LivingCommunicationStats stats={communicationStats} t={t} />

          <div className="hidden md:block">
            <DashboardQuickActions compact />
          </div>
        </>
      ) : (
        <OnboardingCards onboarding={onboarding} compact />
      )}
    </div>
  );
}
