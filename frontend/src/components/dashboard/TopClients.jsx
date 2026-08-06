import { memo } from "react";
import { Users, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useDashboardLang } from "@/hooks/useDashboardLang";
import { formatQuoteAmount } from "@/utils/quoteDisplay";
import { formatLastInteraction, getClientColor, getClientInitials } from "@/utils/clientDisplay";

function TopClients({ clients, loading, compact = false, variant = "default" }) {
  const { t, lang } = useDashboardLang();
  const navigate = useNavigate();
  const living = variant === "living";

  return (
    <section
      data-testid="top-clients-section"
      className={[
        "bg-dash-surface border border-dash-border rounded-xl shadow-[0_1px_2px_rgba(10,37,64,0.04)]",
        compact ? "p-4" : "p-4 md:p-5",
      ].join(" ")}
    >
      {!living ? (
        <div className={["flex items-start justify-between", compact ? "mb-3" : "mb-4"].join(" ")}>
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-dash-accent-soft flex items-center justify-center shrink-0">
              <Users className="w-4 h-4 text-dash-primary" strokeWidth={2} />
            </div>
            <div className="min-w-0">
              <h3 className="font-cabinet text-base md:text-lg font-bold text-dash-text tracking-tight">
                {t("dashboardV2.topClients.title")}
              </h3>
              <p className="text-xs text-dash-text-muted mt-0.5 truncate">
                {t("dashboardV2.topClients.subtitle")}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => navigate("/dashboard/clients")}
            className="text-xs font-medium text-dash-primary hover:text-[#173A5E] shrink-0"
            data-testid="top-clients-view-all"
          >
            {t("dashboardV2.topClients.viewAll")}
          </button>
        </div>
      ) : null}

      {loading ? (
        <div className="flex items-center justify-center py-8 text-dash-text-muted">
          <Loader2 className="w-5 h-5 animate-spin" />
        </div>
      ) : !clients?.length ? (
        <p className="text-sm text-dash-text-muted py-4">{t("dashboardV2.topClients.empty")}</p>
      ) : (
        <div className="overflow-x-auto -mx-1">
          <table className="w-full min-w-[480px] text-left" data-testid="top-clients-table">
            <thead>
              <tr className="border-b border-dash-border-soft">
                <th className="pb-2 pl-1 pr-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-dash-text-subtle">
                  {t("dashboardV2.topClients.col.name")}
                </th>
                <th className="pb-2 px-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-dash-text-subtle text-right">
                  {t("dashboardV2.topClients.col.revenue")}
                </th>
                {living ? (
                  <th className="pb-2 px-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-dash-text-subtle text-right hidden sm:table-cell">
                    {t("livingDashboard.topClients.conversations")}
                  </th>
                ) : (
                  <>
                    <th className="pb-2 px-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-dash-text-subtle text-right hidden sm:table-cell">
                      {t("dashboardV2.topClients.col.quotes")}
                    </th>
                    <th className="pb-2 px-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-dash-text-subtle text-right hidden sm:table-cell">
                      {t("dashboardV2.topClients.col.invoices")}
                    </th>
                  </>
                )}
                <th className="pb-2 pl-2 pr-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-dash-text-subtle text-right">
                  {living
                    ? t("livingDashboard.topClients.lastActivity")
                    : t("dashboardV2.topClients.col.lastContact")}
                </th>
              </tr>
            </thead>
            <tbody>
              {clients.map((client) => {
                const initials = getClientInitials({ name: client.clientName });
                const color = getClientColor(client.clientId);
                const conversations =
                  client.conversationCount ??
                  (client.quoteCount || 0) + (client.invoiceCount || 0);
                return (
                  <tr
                    key={client.clientId}
                    className="border-b border-dash-border-soft last:border-0 hover:bg-dash-surface-muted transition-colors"
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
                        <span className="text-[13px] font-medium text-dash-text truncate">
                          {client.clientName}
                        </span>
                      </button>
                    </td>
                    <td className="py-2.5 px-2 text-right text-[13px] font-semibold text-dash-primary tabular-nums whitespace-nowrap">
                      {formatQuoteAmount(client.total, lang)}
                    </td>
                    {living ? (
                      <td className="py-2.5 px-2 text-right text-[13px] tabular-nums text-dash-text-muted hidden sm:table-cell">
                        {conversations}
                      </td>
                    ) : (
                      <>
                        <td className="py-2.5 px-2 text-right text-[13px] tabular-nums text-dash-text-muted hidden sm:table-cell">
                          {client.quoteCount || 0}
                        </td>
                        <td className="py-2.5 px-2 text-right text-[13px] tabular-nums text-dash-text-muted hidden sm:table-cell">
                          {client.invoiceCount || 0}
                        </td>
                      </>
                    )}
                    <td className="py-2.5 pl-2 pr-1 text-right text-[11px] text-dash-text-muted whitespace-nowrap">
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
