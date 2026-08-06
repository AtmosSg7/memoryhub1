import { memo } from "react";
import {
  Banknote,
  FileUp,
  ListChecks,
  MailOpen,
  UserPlus,
  Users,
  Wallet,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

const ITEMS = [
  { key: "unread", icon: MailOpen, tone: "text-dash-primary bg-dash-accent-soft" },
  { key: "actions", icon: ListChecks, tone: "text-[#3730A3] bg-[#EEF2FF]" },
  { key: "prospects", icon: UserPlus, tone: "text-[#9A3412] bg-[#FFF7ED]" },
  { key: "newClients", icon: Users, tone: "text-[#065F46] bg-[#ECFDF5]" },
  { key: "importsToday", icon: FileUp, tone: "text-[#075985] bg-[#F0F9FF]" },
  { key: "collected", icon: Banknote, tone: "text-[#065F46] bg-[#ECFDF5]", isMoney: true },
  { key: "pendingPayments", icon: Wallet, tone: "text-[#9A3412] bg-[#FFF7ED]" },
];

function LivingKpiStrip({ kpis, loading, t }) {
  if (loading && !kpis) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-2" data-testid="living-kpi-loading">
        {Array.from({ length: 7 }).map((_, i) => (
          <Skeleton key={i} className="h-20 rounded-xl bg-dash-surface-muted" />
        ))}
      </div>
    );
  }

  return (
    <div
      className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-2"
      data-testid="living-kpi-strip"
    >
      {ITEMS.map(({ key, icon: Icon, tone, isMoney }) => {
        let value = kpis?.[key];
        if (key === "collected") value = kpis?.collected;
        if (key === "pendingPayments") value = kpis?.pendingLabel ?? kpis?.pendingPayments;
        return (
          <div
            key={key}
            className="rounded-xl border border-dash-border bg-dash-surface p-3 min-h-[84px]"
            data-testid={`living-kpi-${key}`}
          >
            <div className={`inline-flex h-7 w-7 items-center justify-center rounded-lg ${tone}`}>
              <Icon className="w-3.5 h-3.5" strokeWidth={1.75} />
            </div>
            <p className="mt-2 text-lg font-semibold text-dash-text tracking-tight tabular-nums truncate">
              {isMoney ? value || "—" : value ?? 0}
            </p>
            <p className="text-[11px] text-dash-text-subtle leading-snug">
              {t(`livingDashboard.kpis.${key}`)}
            </p>
          </div>
        );
      })}
    </div>
  );
}

export default memo(LivingKpiStrip);
