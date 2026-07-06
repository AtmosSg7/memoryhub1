import { Plus, Search, Users, FileText, Receipt, TrendingUp } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useDashboardLang } from "@/hooks/useDashboardLang";
import { usePageTitle } from "@/hooks/usePageTitle";
import { useAddClient } from "@/context/AddClientContext";
import { useDashboardStats } from "@/hooks/useDashboardStats";
import { useReminders } from "@/hooks/useReminders";
import { formatInvoiceAmount } from "@/utils/invoiceDisplay";
import StatCard from "@/components/dashboard/StatCard";
import ActivityFeed from "@/components/dashboard/ActivityFeed";
import TodayActions from "@/components/dashboard/TodayActions";
import BetaWelcome from "@/components/dashboard/BetaWelcome";
import { ActionButton } from "@/components/dashboard/ActionButton";

export default function DashboardHome() {
  const { t, lang } = useDashboardLang();
  usePageTitle("page.dashboard.title");
  const { openAddClient } = useAddClient();
  const navigate = useNavigate();
  const { kpis, loading } = useDashboardStats();
  const { reminders, loading: remindersLoading, error: remindersError } = useReminders(20);
  const isEmptyAccount = !loading && kpis.clientsTotal === 0;

  return (
    <div className="space-y-8" data-testid="dashboard-home">
      {isEmptyAccount ? <BetaWelcome /> : null}

      <section id="dashboard-actions" className="space-y-4" aria-labelledby="today-heading">
        <div className="flex items-center justify-between gap-3">
          <h2
            id="today-heading"
            className="font-cabinet text-xl md:text-2xl font-bold text-[#111827] tracking-tight"
          >
            {t("dashboardV2.today.title")}
          </h2>
          <div className="flex items-center gap-2 shrink-0">
            <ActionButton
              variant="secondary"
              onClick={() => navigate("/dashboard/search")}
              className="w-10 px-0"
              aria-label={t("actions.search")}
              data-testid="dashboard-hero-secondary"
            >
              <Search className="w-4 h-4" />
            </ActionButton>
            <ActionButton
              variant="primary"
              onClick={openAddClient}
              data-testid="dashboard-hero-primary"
            >
              <Plus className="w-4 h-4" />
              {t("actions.createClient")}
            </ActionButton>
          </div>
        </div>
        <TodayActions reminders={reminders} loading={remindersLoading} error={remindersError} />
      </section>

      <div className="space-y-4 opacity-80">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 md:gap-3" data-testid="stats-grid">
          <StatCard
            label={t("dashboardV2.stats.clients")}
            value={loading ? "—" : kpis.clientsTotal}
            icon={Users}
            muted
            onClick={() => navigate("/dashboard/clients")}
            testId="stat-total-clients"
          />
          <StatCard
            label={t("dashboardV2.stats.quotesTotal")}
            value={loading ? "—" : kpis.quotesTotal}
            icon={FileText}
            muted
            onClick={() => navigate("/dashboard/quotes")}
            testId="stat-quotes-total"
          />
          <StatCard
            label={t("dashboardV2.stats.invoicesTotal")}
            value={loading ? "—" : kpis.invoicesTotal}
            icon={Receipt}
            muted
            onClick={() => navigate("/dashboard/invoices")}
            testId="stat-invoices-total"
          />
          <StatCard
            label={t("dashboardV2.stats.monthlyRevenue")}
            value={loading ? "—" : formatInvoiceAmount(kpis.monthlyRevenue.total, lang)}
            icon={TrendingUp}
            muted
            testId="stat-monthly-revenue"
          />
        </div>

        <ActivityFeed limit={5} compact muted showEmptyState={isEmptyAccount} />
      </div>
    </div>
  );
}
