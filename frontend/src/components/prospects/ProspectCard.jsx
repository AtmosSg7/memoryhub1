import { Building2, Mail, MessageSquare, Phone } from "lucide-react";
import { useDashboardLang } from "@/hooks/useDashboardLang";
import { ActionButton } from "@/components/dashboard/ActionButton";
import {
  formatProspectDateShort,
  prospectDisplayName,
} from "@/components/prospects/prospectFormat";

function StatusBadge({ status, t }) {
  const key = `prospects.status.${status}`;
  const label = t(key);
  const styles = {
    pending: "text-dash-accent bg-dash-accent-soft",
    ignored: "text-dash-text-muted bg-dash-surface-muted",
    associated: "text-[color:var(--dash-success-text)] bg-[color:var(--dash-success-bg)]",
    converted: "text-[color:var(--dash-success-text)] bg-[color:var(--dash-success-bg)]",
    automatic: "text-dash-text-muted bg-dash-surface-muted",
  };
  return (
    <span
      className={[
        "text-[11px] font-medium rounded-md px-1.5 py-0.5",
        styles[status] || styles.pending,
      ].join(" ")}
    >
      {label === key ? status : label}
    </span>
  );
}

export default function ProspectCard({
  prospect,
  busy = false,
  onTreat,
  onRestore,
  showRestore = false,
}) {
  const { t, lang } = useDashboardLang();
  const name = prospectDisplayName(prospect);
  const count = prospect.communicationsCount ?? 0;

  return (
    <article
      className="rounded-xl border border-dash-border bg-dash-surface dash-panel px-4 py-3 space-y-3"
      data-testid={`prospect-card-${prospect.id}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={prospect.status} t={t} />
            {prospect.source === "gmail" || prospect.source === "email" ? (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-dash-text-muted bg-dash-surface-muted rounded-md px-1.5 py-0.5">
                <Mail className="w-3 h-3" />
                {t("prospects.sourceGmail")}
              </span>
            ) : null}
            {prospect.source === "phone" || prospect.channel === "phone" ? (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-dash-text-muted bg-dash-surface-muted rounded-md px-1.5 py-0.5">
                <Phone className="w-3 h-3" />
                {t("prospects.sourcePhone")}
              </span>
            ) : null}
            {prospect.noiseClass ? (
              <span className="text-[11px] text-dash-text-subtle">
                {t(`prospects.noise.${prospect.noiseClass}`) !== `prospects.noise.${prospect.noiseClass}`
                  ? t(`prospects.noise.${prospect.noiseClass}`)
                  : t("prospects.noise.generic")}
              </span>
            ) : null}
          </div>

          <h3 className="text-sm font-semibold text-dash-text truncate">{name}</h3>

          {prospect.company && prospect.company !== name ? (
            <p className="text-xs text-dash-text-muted truncate inline-flex items-center gap-1">
              <Building2 className="w-3 h-3 shrink-0" />
              {prospect.company}
            </p>
          ) : null}

          {prospect.email ? (
            <p className="text-xs text-dash-text-muted truncate">{prospect.email}</p>
          ) : null}
          {prospect.phone ? (
            <p className="text-xs text-dash-text-muted truncate">{prospect.phone}</p>
          ) : null}

          {prospect.lastSubject ? (
            <p className="text-sm text-dash-text truncate pt-0.5">
              {prospect.lastSubject}
            </p>
          ) : null}

          {prospect.lastPreview ? (
            <p className="text-[13px] text-dash-text-muted line-clamp-2 leading-relaxed">
              {prospect.lastPreview}
            </p>
          ) : null}
        </div>

        <div className="text-right shrink-0 space-y-1.5 max-w-[40%]">
          <p className="text-[11px] text-dash-text-subtle tabular-nums whitespace-nowrap">
            {formatProspectDateShort(prospect.lastContactAt, lang)}
          </p>
          <p className="inline-flex items-center gap-1 text-[11px] text-dash-text-muted justify-end">
            <MessageSquare className="w-3 h-3" />
            {t("prospects.exchanges").replace("{count}", String(count))}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
        <p className="text-[11px] text-dash-text-subtle">
          {t("prospects.firstContact")}: {formatProspectDateShort(prospect.firstContactAt, lang)}
        </p>
        <div className="flex flex-wrap gap-2 w-full sm:w-auto sm:justify-end">
          {prospect.phone && !showRestore ? (
            <ActionButton
              variant="secondary"
              className="h-10 text-sm flex-1 sm:flex-none min-w-[8rem]"
              onClick={() => {
                window.location.href = `tel:${prospect.phone}`;
              }}
              data-testid={`prospect-callback-${prospect.id}`}
            >
              {t("calls.actions.callBack")}
            </ActionButton>
          ) : null}
          {showRestore ? (
            <ActionButton
              variant="quick"
              className="h-10 text-sm flex-1 sm:flex-none min-w-[8rem]"
              disabled={busy}
              onClick={() => onRestore?.(prospect)}
              data-testid={`prospect-restore-${prospect.id}`}
            >
              {t("prospects.restore")}
            </ActionButton>
          ) : (
            <ActionButton
              variant="primary"
              className="h-10 text-sm flex-1 sm:flex-none min-w-[8rem]"
              disabled={busy}
              onClick={() => onTreat?.(prospect)}
              data-testid={`prospect-treat-${prospect.id}`}
            >
              {t("prospects.treat")}
            </ActionButton>
          )}
        </div>
      </div>
    </article>
  );
}
