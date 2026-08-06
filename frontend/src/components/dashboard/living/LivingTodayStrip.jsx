import { memo } from "react";
import { FileUp, Mail, MessageCircle, Phone } from "lucide-react";
import { useNavigate } from "react-router-dom";

function countBy(events, pred) {
  return (events || []).filter(pred).length;
}

function LivingTodayStrip({ events, importsToday, phoneToday = 0, t }) {
  const navigate = useNavigate();
  const emails = countBy(
    events,
    (e) =>
      String(e.type || "").startsWith("email_") ||
      e.entityType === "email" ||
      e.category === "communications",
  );
  const docs = Math.max(
    importsToday || 0,
    countBy(
      events,
      (e) =>
        String(e.type || "").includes("document") ||
        String(e.type || "").includes("import") ||
        e.entityType === "quote" ||
        e.entityType === "invoice",
    ),
  );
  const callsFromEvents = countBy(
    events,
    (e) =>
      e.type === "call_logged" ||
      e.entityType === "call" ||
      String(e.type || "").includes("call"),
  );

  const cards = [
    {
      key: "emails",
      icon: Mail,
      count: emails,
      path: "/dashboard/communications",
      ready: true,
    },
    {
      key: "calls",
      icon: Phone,
      count: Math.max(phoneToday || 0, callsFromEvents),
      path: "/dashboard/calls",
      ready: true,
    },
    {
      key: "whatsapp",
      icon: MessageCircle,
      count: 0,
      path: null,
      ready: false,
    },
    {
      key: "documents",
      icon: FileUp,
      count: docs,
      path: "/dashboard/documents",
      ready: true,
    },
  ];

  return (
    <section className="space-y-2" data-testid="living-today">
      <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-dash-text-subtle">
        {t("livingDashboard.today.title")}
      </h2>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        {cards.map(({ key, icon: Icon, count, path, ready }) => (
          <button
            key={key}
            type="button"
            disabled={!ready}
            onClick={() => path && navigate(path)}
            className={[
              "rounded-xl border border-dash-border bg-dash-surface p-4 text-left transition-colors min-h-[88px]",
              ready ? "hover:bg-dash-bg hover:shadow-sm" : "opacity-60 cursor-not-allowed",
            ].join(" ")}
            data-testid={`living-today-${key}`}
          >
            <Icon className="w-4 h-4 text-dash-primary mb-2" />
            <p className="text-2xl font-semibold text-dash-text tabular-nums">{count}</p>
            <p className="text-xs text-dash-text-muted mt-0.5">
              {t(`livingDashboard.today.${key}`)}
              {!ready ? ` · ${t("livingDashboard.soon")}` : ""}
            </p>
          </button>
        ))}
      </div>
    </section>
  );
}

export default memo(LivingTodayStrip);
