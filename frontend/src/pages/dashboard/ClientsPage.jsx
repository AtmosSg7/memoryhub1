import { useNavigate } from "react-router-dom";

import { Plus, Users } from "lucide-react";

import { useDashboardLang } from "@/hooks/useDashboardLang";
import { usePageTitle } from "@/hooks/usePageTitle";

import { useAddClient } from "@/context/AddClientContext";

import { useClients } from "@/hooks/useClients";

import PageHeader from "@/components/dashboard/PageHeader";

import EmptyState from "@/components/dashboard/EmptyState";

import { PageError, PageLoader } from "@/components/dashboard/PageFeedback";

import StatusBadge from "@/components/dashboard/StatusBadge";

import {

  formatLastInteraction,

  getClientColor,

  getClientInitials,

  getDisplayCompany,

  getDisplayName,

} from "@/utils/clientDisplay";



export default function ClientsPage() {

  const { t, lang } = useDashboardLang();
  usePageTitle("page.clients.title");

  const navigate = useNavigate();

  const { openAddClient } = useAddClient();

  const { clients, loading, error } = useClients();



  return (

    <div className="space-y-6" data-testid="clients-page">

      <PageHeader

        title={t("page.clients.title")}

        subtitle={t("page.clients.subtitle")}

        primaryLabel={t("actions.createClient")}

        primaryIcon={Plus}

        onPrimary={openAddClient}

        testId="clients-header"

      />



      {loading ? (

        <PageLoader label={t("clientForm.loading")} testId="clients-loading" />

      ) : error ? (

        <PageError message={error} testId="clients-error" />

      ) : clients.length === 0 ? (

        <EmptyState

          icon={Users}

          title={t("empty.noClients.title")}

          description={t("empty.noClients.desc")}

          cta={t("empty.noClients.cta")}

          onCta={openAddClient}

          testId="empty-clients"

        />

      ) : (

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">

          {clients.map((client) => {

            const initials = getClientInitials(client);

            const color = getClientColor(client.id);

            const company = getDisplayCompany(client);

            const name = getDisplayName(client);



            return (

              <button

                key={client.id}

                onClick={() => navigate(`/dashboard/clients/${client.id}`)}

                data-testid={`client-card-${client.id}`}

                className="group text-left bg-white border border-[#E5E7EB] rounded-xl p-5 hover:-translate-y-0.5 hover:shadow-[0_8px_24px_-16px_rgba(10,37,64,0.2)] hover:border-[#0A2540]/20 transition-all"

              >

                <div className="flex items-start justify-between gap-3 mb-3">

                  <div className="flex items-center gap-3 min-w-0">

                    <div

                      className="w-10 h-10 rounded-lg flex items-center justify-center text-xs font-semibold text-white shrink-0"

                      style={{ backgroundColor: color }}

                    >

                      {initials}

                    </div>

                    <div className="leading-tight min-w-0">

                      <div className="font-medium text-[#111827] truncate">{company}</div>

                      <div className="text-[11px] text-[#6B7280] truncate">{name}</div>

                    </div>

                  </div>

                  <StatusBadge kind="client" status={client.status} size="sm" />

                </div>

                <div className="text-[12px] text-[#6B7280] truncate">{client.activity || "—"}</div>

                <div className="text-[11px] text-[#9CA3AF] mt-1">

                  {formatLastInteraction(client.updatedAt, lang)}

                </div>

              </button>

            );

          })}

        </div>

      )}

    </div>

  );

}


