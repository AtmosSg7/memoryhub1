import { memo } from "react";
import { FileText, Mail, MessageCircle, Phone } from "lucide-react";

function LivingCommunicationStats({ stats, t }) {
  const rows = [
    { key: "email", icon: Mail, d7: stats?.email7 ?? 0, d30: stats?.email30 ?? 0 },
    { key: "call", icon: Phone, d7: stats?.call7 ?? 0, d30: stats?.call30 ?? 0 },
    { key: "whatsapp", icon: MessageCircle, d7: stats?.whatsapp7 ?? 0, d30: stats?.whatsapp30 ?? 0, soon: true },
    { key: "docs", icon: FileText, d7: stats?.docs7 ?? 0, d30: stats?.docs30 ?? 0 },
  ];

  return (
    <section className="space-y-2" data-testid="living-comms">
      <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-dash-text-subtle">
        {t("livingDashboard.comms.title")}
      </h2>
      <div className="rounded-xl border border-dash-border bg-dash-surface overflow-hidden">
        <div className="grid grid-cols-[1fr_auto_auto] gap-2 px-4 py-2 text-[10px] uppercase tracking-wider text-dash-text-subtle border-b border-dash-border-soft">
          <span>{t("livingDashboard.comms.channel")}</span>
          <span className="w-12 text-right">7j</span>
          <span className="w-12 text-right">30j</span>
        </div>
        {rows.map(({ key, icon: Icon, d7, d30, soon }) => (
          <div
            key={key}
            className="grid grid-cols-[1fr_auto_auto] gap-2 px-4 py-3 items-center border-b border-dash-border-soft last:border-0"
            data-testid={`living-comms-${key}`}
          >
            <div className="flex items-center gap-2 min-w-0">
              <Icon className="w-4 h-4 text-dash-primary shrink-0" />
              <span className="text-sm text-dash-text truncate">
                {t(`livingDashboard.comms.${key}`)}
                {soon ? (
                  <span className="ml-1 text-[10px] text-dash-text-subtle">
                    {t("livingDashboard.soon")}
                  </span>
                ) : null}
              </span>
            </div>
            <span className="w-12 text-right text-sm font-medium tabular-nums text-dash-text">{d7}</span>
            <span className="w-12 text-right text-sm font-medium tabular-nums text-dash-text-muted">{d30}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

export default memo(LivingCommunicationStats);
