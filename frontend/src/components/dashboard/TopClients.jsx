import { Users, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useDashboardLang } from "@/hooks/useDashboardLang";
import { formatQuoteAmount } from "@/utils/quoteDisplay";
import { getClientColor, getClientInitials } from "@/utils/clientDisplay";

export default function TopClients({ clients, loading, compact = false }) {
  const { t, lang } = useDashboardLang();
  const navigate = useNavigate();

  return (
    <section
      data-testid="top-clients-section"
      className={[
        "bg-white border border-[#E5E7EB] rounded-xl",
        compact ? "p-4" : "p-5 md:p-6",
      ].join(" ")}
    >
      <div className={["flex items-start justify-between", compact ? "mb-3" : "mb-5"].join(" ")}>
        <div className="flex items-center gap-3">
          {!compact && (
            <div className="w-8 h-8 rounded-lg bg-[#EFF6FF] flex items-center justify-center">
              <Users className="w-4 h-4 text-[#0A2540]" strokeWidth={2} />
            </div>
          )}
          <div>
            <h3
              className={[
                "font-cabinet font-bold text-[#111827] tracking-tight",
                compact ? "text-sm" : "text-lg",
              ].join(" ")}
            >
              {t("dashboardV2.topClients.title")}
            </h3>
            {!compact && (
              <p className="text-xs text-[#6B7280] mt-0.5">{t("dashboardV2.topClients.subtitle")}</p>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={() => navigate("/dashboard/clients")}
          className="text-xs font-medium text-[#0A2540] hover:text-[#173A5E]"
        >
          {t("dashboardV2.topClients.viewAll")}
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8 text-[#6B7280]">
          <Loader2 className="w-5 h-5 animate-spin" />
        </div>
      ) : clients.length === 0 ? (
        <p className="text-sm text-[#6B7280] py-4">{t("dashboardV2.topClients.empty")}</p>
      ) : (
        <ul className="space-y-3">
          {clients.map((client, index) => {
            const initials = getClientInitials({ name: client.clientName });
            const color = getClientColor(client.clientId);
            return (
              <li key={client.clientId}>
                <button
                  type="button"
                  onClick={() => navigate(`/dashboard/clients/${client.clientId}`)}
                  className="w-full flex items-center gap-3 p-3 rounded-lg border border-[#F3F4F6] hover:border-[#E5E7EB] hover:bg-[#FAFAFA] transition-colors text-left"
                  data-testid={`top-client-${client.clientId}`}
                >
                  <span className="text-[11px] font-bold text-[#9CA3AF] w-4 tabular-nums">
                    {index + 1}
                  </span>
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-[11px] font-semibold text-white shrink-0"
                    style={{ backgroundColor: color }}
                  >
                    {initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium text-[#111827] truncate">
                      {client.clientName}
                    </p>
                    <p className="text-[11px] text-[#6B7280] mt-0.5">
                      {client.quoteCount > 0 && `${client.quoteCount} ${t("dashboardV2.topClients.quotes")}`}
                      {client.quoteCount > 0 && client.invoiceCount > 0 && " · "}
                      {client.invoiceCount > 0 && `${client.invoiceCount} ${t("dashboardV2.topClients.invoices")}`}
                    </p>
                  </div>
                  <span className="text-[13px] font-semibold text-[#0A2540] tabular-nums shrink-0">
                    {formatQuoteAmount(client.total, lang)}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
