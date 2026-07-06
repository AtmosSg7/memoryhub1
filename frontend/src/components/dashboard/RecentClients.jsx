import { useEffect, useState } from "react";

import { useNavigate } from "react-router-dom";

import { ArrowUpRight, Loader2 } from "lucide-react";

import { useDashboardLang } from "@/hooks/useDashboardLang";

import { useAddClient } from "@/context/AddClientContext";

import { getRecentClients } from "@/lib/clientsApi";

import {

  formatLastInteraction,

  getClientColor,

  getClientInitials,

  getDisplayCompany,

  getDisplayName,

} from "@/utils/clientDisplay";

import StatusBadge from "@/components/dashboard/StatusBadge";



export default function RecentClients() {

  const { t, lang } = useDashboardLang();

  const navigate = useNavigate();

  const { refreshKey } = useAddClient();

  const [clients, setClients] = useState([]);

  const [loading, setLoading] = useState(true);



  useEffect(() => {

    let active = true;

    (async () => {

      setLoading(true);

      try {

        const data = await getRecentClients();

        if (active) setClients(data || []);

      } catch {

        if (active) setClients([]);

      } finally {

        if (active) setLoading(false);

      }

    })();

    return () => {

      active = false;

    };

  }, [refreshKey]);



  return (

    <section

      data-testid="recent-clients-section"

      className="bg-white border border-[#E5E7EB] rounded-xl overflow-hidden"

    >

      <div className="flex items-start justify-between p-5 md:p-6 pb-4">

        <div>

          <h3 className="font-cabinet text-lg font-bold text-[#111827] tracking-tight">

            {t("recentClients.title")}

          </h3>

          <p className="text-xs text-[#6B7280] mt-0.5">

            {t("recentClients.subtitle")}

          </p>

        </div>

        <button

          onClick={() => navigate("/dashboard/clients")}

          data-testid="recent-clients-view-all"

          className="text-xs font-medium text-[#0A2540] hover:text-[#173A5E] flex items-center gap-1 group"

        >

          {t("recentClients.viewAll")}

          <ArrowUpRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />

        </button>

      </div>



      {loading ? (

        <div className="flex items-center justify-center py-10 text-[#6B7280]">

          <Loader2 className="w-4 h-4 animate-spin mr-2" />

          {t("clientForm.loading")}

        </div>

      ) : clients.length === 0 ? (

        <div className="px-6 pb-6 text-sm text-[#6B7280] leading-relaxed">
          {t("empty.noClients.desc")}
        </div>

      ) : (

        <div className="overflow-x-auto">

          <table className="w-full text-sm">

            <thead>

              <tr className="border-y border-[#F3F4F6] bg-[#FAFAFA]">

                <th className="text-left px-6 py-2.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#6B7280]">

                  {t("recentClients.col.client")}

                </th>

                <th className="text-left px-4 py-2.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#6B7280]">

                  {t("recentClients.col.company")}

                </th>

                <th className="text-left px-4 py-2.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#6B7280]">

                  {t("recentClients.col.lastInteraction")}

                </th>

                <th className="text-left px-4 py-2.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#6B7280]">

                  {t("recentClients.col.status")}

                </th>

                <th className="px-6 py-2.5" />

              </tr>

            </thead>

            <tbody>

              {clients.map((client) => {

                const initials = getClientInitials(client);

                const color = getClientColor(client.id);

                const company = getDisplayCompany(client);

                const name = getDisplayName(client);



                return (

                  <tr

                    key={client.id}

                    onClick={() => navigate(`/dashboard/clients/${client.id}`)}

                    data-testid={`recent-client-row-${client.id}`}

                    className="border-b border-[#F3F4F6] last:border-0 hover:bg-[#F9FAFB] transition-colors cursor-pointer"

                  >

                    <td className="px-6 py-3.5 whitespace-nowrap">

                      <div className="flex items-center gap-3">

                        <div

                          className="w-8 h-8 rounded-lg flex items-center justify-center text-[11px] font-semibold text-white"

                          style={{ backgroundColor: color }}

                        >

                          {initials}

                        </div>

                        <div className="flex flex-col leading-tight">

                          <span className="font-medium text-[#111827]">{company}</span>

                          <span className="text-[11px] text-[#6B7280]">{name}</span>

                        </div>

                      </div>

                    </td>

                    <td className="px-4 py-3.5 text-[#4B5563] whitespace-nowrap">

                      {client.activity || "—"}

                    </td>

                    <td className="px-4 py-3.5 text-[#4B5563] whitespace-nowrap">

                      {formatLastInteraction(client.updatedAt, lang)}

                    </td>

                    <td className="px-4 py-3.5 whitespace-nowrap">

                      <StatusBadge kind="client" status={client.status} dot />

                    </td>

                    <td className="px-6 py-3.5 text-right">

                      <button

                        onClick={(e) => {

                          e.stopPropagation();

                          navigate(`/dashboard/clients/${client.id}`);

                        }}

                        data-testid={`recent-client-open-${client.id}`}

                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium text-[#0A2540] bg-[#F3F4F6] hover:bg-[#EFF6FF] transition-colors"

                      >

                        {t("common.viewDetails")}

                      </button>

                    </td>

                  </tr>

                );

              })}

            </tbody>

          </table>

        </div>

      )}

    </section>

  );

}


