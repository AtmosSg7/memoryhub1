import { memo } from "react";
import { Users, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useDashboardLang } from "@/hooks/useDashboardLang";
import { formatQuoteAmount } from "@/utils/quoteDisplay";
import { formatLastInteraction, getClientColor, getClientInitials } from "@/utils/clientDisplay";

function TopClients({ clients, loading, compact = false }) {
  const { t, lang } = useDashboardLang();
  const navigate = useNavigate();

  return (
    <section
      data-testid="top-clients-section"
      className={[
        "bg-white border border-[#E5E7EB] rounded-xl shadow-[0_1px_2px_rgba(10,37,64,0.04)]",
        compact ? "p-4" : "p-4 md:p-5",
      ].join(" ")}
    >
      <div className={["flex items-start justify-between", compact ? "mb-3" : "mb-4"].join(" ")}>
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-[#EFF6FF] flex items-center justify-center shrink-0">
            <Users className="w-4 h-4 text-[#0A2540]" strokeWidth={2} />
          </div>
          <div className="min-w-0">
            <h3 className="font-cabinet text-base md:text-lg font-bold text-[#111827] tracking-tight">
              {t("dashboardV2.topClients.title")}
            </h3>
            <p className="text-xs text-[#6B7280] mt-0.5 truncate">
              {t("dashboardV2.topClients.subtitle")}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => navigate("/dashboard/clients")}
          className="text-xs font-medium text-[#0A2540] hover:text-[#173A5E] shrink-0"
        >
          {t("dashboardV2.topClients.viewAll")}
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8 text-[#6B7280]">
          <Loader2 className="w-5 h-5 animate-spin" />
        </div>
      ) : !clients?.length ? (
        <p className="text-sm text-[#6B7280] py-4">{t("dashboardV2.topClients.empty")}</p>
      ) : (
        <div className="overflow-x-auto -mx-1">
          <table className="w-full min-w-[520px] text-left" data-testid="top-clients-table">
            <thead>
              <tr className="border-b border-[#F3F4F6]">
                <th className="pb-2 pl-1 pr-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#9CA3AF]">
                  {t("dashboardV2.topClients.col.name")}
                </th>
                <th className="pb-2 px-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#9CA3AF] text-right">
                  {t("dashboardV2.topClients.col.revenue")}
                </th>
                <th className="pb-2 px-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#9CA3AF] text-right hidden sm:table-cell">
                  {t("dashboardV2.topClients.col.quotes")}
                </th>
                <th className="pb-2 px-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#9CA3AF] text-right hidden sm:table-cell">
                  {t("dashboardV2.topClients.col.invoices")}
                </th>
                <th className="pb-2 pl-2 pr-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#9CA3AF] text-right">
                  {t("dashboardV2.topClients.col.lastContact")}
                </th>
              </tr>
            </thead>
            <tbody>
              {clients.map((client) => {
                const initials = getClientInitials({ name: client.clientName });
                const color = getClientColor(client.clientId);
                return (
                  <tr
                    key={client.clientId}
                    className="border-b border-[#F9FAFB] last:border-0 hover:bg-[#FAFAFA] transition-colors"
                  >
                    <td className="py-2.5 pl-1 pr-2">
                      <button
                        type="button"
                        onClick={() => navigate(`/dashboard/clients/${client.clientId}`)}
                        className="flex items-center gap-2.5 text-left min-w-0 max-w-full"
                        data-testid={`top-client-${client.clientId}`}
                      >
                        <div
                          className="w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-semibold text-white shrink-0"
                          style={{ backgroundColor: color }}
                        >
                          {initials}
                        </div>
                        <span className="text-[13px] font-medium text-[#111827] truncate">
                          {client.clientName}
                        </span>
                      </button>
                    </td>
                    <td className="py-2.5 px-2 text-right text-[13px] font-semibold text-[#0A2540] tabular-nums whitespace-nowrap">
                      {formatQuoteAmount(client.total, lang)}
                    </td>
                    <td className="py-2.5 px-2 text-right text-[13px] tabular-nums text-[#4B5563] hidden sm:table-cell">
                      {client.quoteCount || 0}
                    </td>
                    <td className="py-2.5 px-2 text-right text-[13px] tabular-nums text-[#4B5563] hidden sm:table-cell">
                      {client.invoiceCount || 0}
                    </td>
                    <td className="py-2.5 pl-2 pr-1 text-right text-[11px] text-[#6B7280] whitespace-nowrap">
                      {formatLastInteraction(client.lastContactAt, lang)}
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

export default memo(TopClients);
