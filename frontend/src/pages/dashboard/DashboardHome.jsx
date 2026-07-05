import { Plus, Search, Users, FolderClosed, StickyNote, SearchCheck } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useDashboardLang } from "@/hooks/useDashboardLang";
import { useAddClient } from "@/context/AddClientContext";
import { useClients } from "@/hooks/useClients";
import { useNotes } from "@/hooks/useNotes";
import { stats } from "@/data/mockData";
import StatCard from "@/components/dashboard/StatCard";
import RecentClients from "@/components/dashboard/RecentClients";
import ActivityFeed from "@/components/dashboard/ActivityFeed";
import SearchPreview from "@/components/dashboard/SearchPreview";
import PageHeader from "@/components/dashboard/PageHeader";

export default function DashboardHome() {
  const { t } = useDashboardLang();
  const { openAddClient } = useAddClient();
  const { total } = useClients();
  const { total: notesTotal } = useNotes();
  const navigate = useNavigate();

  const handleSearch = () => navigate("/dashboard/search");



  return (

    <div className="space-y-8" data-testid="dashboard-home">

      <PageHeader

        eyebrow={t("hero.badge")}

        title={t("hero.welcome")}

        subtitle={t("hero.subtitle")}

        primaryLabel={t("hero.cta.addClient")}

        primaryIcon={Plus}

        onPrimary={openAddClient}

        secondaryLabel={t("hero.cta.search")}

        secondaryIcon={Search}

        onSecondary={handleSearch}

        testId="dashboard-hero"

      />



      <div

        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5"

        data-testid="stats-grid"

      >

        <StatCard

          label={t("stats.totalClients")}

          value={total}

          trend={stats.totalClientsTrend}

          helper={t("stats.thisMonth")}

          icon={Users}

          accent

          testId="stat-total-clients"

        />

        <StatCard

          label={t("stats.documentsStored")}

          value={stats.documentsStored.toLocaleString("fr-FR")}

          trend={stats.documentsTrend}

          helper={t("stats.thisMonth")}

          icon={FolderClosed}

          testId="stat-documents"

        />

        <StatCard

          label={t("stats.notesCreated")}

          value={notesTotal}

          trend={stats.notesTrend}

          helper={t("stats.thisMonth")}

          icon={StickyNote}

          testId="stat-notes"

        />

        <StatCard

          label={t("stats.recentSearches")}

          value={stats.recentSearches}

          trend={stats.recentSearchesTrend}

          helper={t("stats.thisMonth")}

          icon={SearchCheck}

          testId="stat-searches"

        />

      </div>



      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 md:gap-6">

        <div className="lg:col-span-2 space-y-5 md:space-y-6">

          <RecentClients />

          <ActivityFeed />

        </div>

        <div className="lg:col-span-1 space-y-5 md:space-y-6">

          <SearchPreview />

          <QuickHints />

        </div>

      </div>

    </div>

  );

}



function QuickHints() {

  const { t, lang } = useDashboardLang();

  const items = {

    fr: [

      { k: "Astuce", label: "Tapez ⌘K pour lancer une recherche instantanée." },

      { k: "Nouveau", label: "Glissez un PDF n'importe où pour l'associer à un client." },

      { k: "Pro", label: "Connectez Gmail pour indexer 6 mois d'e-mails passés." },

    ],

    en: [

      { k: "Tip", label: "Press ⌘K to launch an instant search." },

      { k: "New", label: "Drop a PDF anywhere to attach it to a client." },

      { k: "Pro", label: "Connect Gmail to index 6 months of past emails." },

    ],

  };

  return (

    <section

      className="bg-white border border-[#E5E7EB] rounded-xl p-5 md:p-6"

      data-testid="quick-hints"

    >

      <h3 className="font-cabinet text-lg font-bold text-[#111827] tracking-tight mb-4">

        {t("quickHints.title")}

      </h3>

      <ul className="space-y-3">

        {items[lang].map((item, idx) => (

          <li

            key={idx}

            className="flex gap-3 items-start p-3 rounded-lg border border-[#F3F4F6] hover:border-[#E5E7EB] hover:bg-[#FAFAFA] transition-colors"

          >

            <span className="mt-0.5 text-[10px] font-semibold uppercase tracking-widest text-[#0A2540] bg-[#EFF6FF] px-1.5 py-0.5 rounded">

              {item.k}

            </span>

            <p className="text-[13px] text-[#4B5563] leading-relaxed">

              {item.label}

            </p>

          </li>

        ))}

      </ul>

    </section>

  );

}


