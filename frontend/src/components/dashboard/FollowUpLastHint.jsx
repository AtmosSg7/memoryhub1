import { useDashboardLang } from "@/hooks/useDashboardLang";
import { formatEventTime } from "@/utils/eventDisplay";

export default function FollowUpLastHint({ last, className = "" }) {
  const { t, lang } = useDashboardLang();
  if (!last?.recordedAt) return null;

  const date = formatEventTime(last.recordedAt, lang);
  const countLabel =
    last.count > 1 ? t("followUpHistory.times").replace("{count}", String(last.count)) : null;

  return (
    <p className={`text-[11px] text-[#B45309] ${className}`} data-testid="follow-up-last-hint">
      {t("followUpHistory.last").replace("{date}", date)}
      {countLabel ? ` · ${countLabel}` : ""}
    </p>
  );
}
