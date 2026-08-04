import { memo, useMemo } from "react";
import { useDashboardLang } from "@/hooks/useDashboardLang";
import DemoDataBadge from "@/components/dashboard/DemoDataBadge";

function formatHeaderDate(lang) {
  const locale = lang === "en" ? "en-GB" : "fr-FR";
  const raw = new Intl.DateTimeFormat(locale, {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date());
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

function DashboardHeader({ firstName, subtitle }) {
  const { t, lang } = useDashboardLang();

  const greeting = useMemo(() => {
    if (firstName) {
      return t("dashboardV2.header.greetingNamed").replace("{name}", firstName);
    }
    return t("dashboardV2.header.greeting");
  }, [firstName, t]);

  const dateLabel = useMemo(() => formatHeaderDate(lang), [lang]);

  return (
    <header className="space-y-1.5" data-testid="dashboard-home-header">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="font-cabinet text-2xl md:text-[32px] font-bold text-dash-text tracking-tight leading-tight">
          {greeting}
        </h1>
        <DemoDataBadge />
      </div>
      <p className="text-sm font-medium text-dash-text-muted">{dateLabel}</p>
      <p className="text-sm text-dash-text-muted max-w-2xl leading-relaxed">
        {subtitle || t("dashboardV2.header.subtitle")}
      </p>
    </header>
  );
}

export default memo(DashboardHeader);
