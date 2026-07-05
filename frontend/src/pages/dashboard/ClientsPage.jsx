import { useNavigate } from "react-router-dom";

import { Plus, Filter, Users, Loader2 } from "lucide-react";

import { useDashboardLang } from "@/hooks/useDashboardLang";

import { useAddClient } from "@/context/AddClientContext";

import { useClients } from "@/hooks/useClients";

import PageHeader from "@/components/dashboard/PageHeader";

import EmptyState from "@/components/dashboard/EmptyState";

import {

  formatLastInteraction,

  getClientColor,

  getClientInitials,

  getDisplayCompany,

  getDisplayName,

} from "@/utils/clientDisplay";

import { toast } from "sonner";



const STATUS_STYLES = {

  active: "bg-[#ECFDF5] text-[#065F46] border-[#A7F3D0]",

  pending: "bg-[#FFFBEB] text-[#92400E] border-[#FCD34D]",

  new: "bg-[#EFF6FF] text-[#0A2540] border-[#BFDBFE]",

  dormant: "bg-[#F3F4F6] text-[#4B5563] border-[#E5E7EB]",

};



export default function ClientsPage() {

  const { t, lang } = useDashboardLang();

  const navigate = useNavigate();

  const { openAddClient } = useAddClient();

  const { clients, loading, error } = useClients();



  return (

    <div className="space-y-6" data-testid="clients-page">

      <PageHeader

        title={t("page.clients.title")}

        subtitle={t("page.clients.subtitle")}

        primaryLabel={t("hero.cta.addClient")}

        primaryIcon={Plus}

        onPrimary={openAddClient}

        secondaryLabel={lang === "fr" ? "Filtrer" : "Filter"}

        secondaryIcon={Filter}

        onSecondary={() =>

          toast.message(lang === "fr" ? "Filtres" : "Filters", {

            description: t("toast.mockOnly"),

          })

        }

        testId="clients-header"

      />



      {loading ? (

        <div

          className="flex items-center justify-center py-16 text-[#6B7280]"

          data-testid="clients-loading"

        >

          <Loader2 className="w-5 h-5 animate-spin mr-2" />

          {t("clientForm.loading")}

        </div>

      ) : error ? (

        <div

          className="rounded-xl border border-[#FECACA] bg-[#FEF2F2] p-5 text-sm text-[#991B1B]"

          data-testid="clients-error"

        >

          {error}

        </div>

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

                <div className="flex items-start justify-between gap-3 mb-4">

                  <div className="flex items-center gap-3">

                    <div

                      className="w-10 h-10 rounded-lg flex items-center justify-center text-xs font-semibold text-white"

                      style={{ backgroundColor: color }}

                    >

                      {initials}

                    </div>

                    <div className="leading-tight">

                      <div className="font-medium text-[#111827]">{company}</div>

                      <div className="text-[11px] text-[#6B7280]">{name}</div>

                    </div>

                  </div>

                  <span

                    className={[

                      "shrink-0 text-[10px] font-medium px-2 py-0.5 rounded-full border",

                      STATUS_STYLES[client.status] || STATUS_STYLES.new,

                    ].join(" ")}

                  >

                    {t(`status.${client.status}`)}

                  </span>

                </div>

                <div className="text-[12.5px] text-[#4B5563]">

                  {client.activity || "—"}

                </div>

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


