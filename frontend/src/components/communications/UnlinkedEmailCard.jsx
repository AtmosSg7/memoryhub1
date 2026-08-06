import { ExternalLink, Mail, MailOpen, Paperclip } from "lucide-react";
import { useDashboardLang } from "@/hooks/useDashboardLang";
import { ActionButton } from "@/components/dashboard/ActionButton";
import CommunicationIntelligenceCard from "@/components/communications/CommunicationIntelligenceCard";

function formatDate(value, lang) {
  if (!value) return "—";
  try {
    return new Intl.DateTimeFormat(lang === "en" ? "en-GB" : "fr-FR", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

export default function UnlinkedEmailCard({
  item,
  onAssociate,
  onCreateClient,
  onIgnore,
  onRestore,
  onAcceptSuggestion,
  onDismissSuggestion,
  onChooseOther,
  busy = false,
}) {
  const { t, lang } = useDashboardLang();
  const inbound = item.direction !== "outbound";
  const DirectionIcon = inbound ? MailOpen : Mail;
  const fromLabel =
    item.fromName && item.fromEmail
      ? `${item.fromName} <${item.fromEmail}>`
      : item.fromEmail || item.fromName || "—";
  const toLabel = (item.toEmails || []).join(", ") || "—";
  const suggestion = item.suggestion;
  const isIgnored = item.status === "ignored";
  const isLinked = item.status === "linked";

  return (
    <article
      className="rounded-xl border border-dash-border bg-dash-surface dash-panel px-4 py-3 space-y-3"
      data-testid={`unlinked-email-${item.id}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-dash-text-muted bg-dash-surface-muted rounded-md px-1.5 py-0.5">
              <DirectionIcon className="w-3 h-3" />
              {inbound ? t("unlinkedEmails.inbound") : t("unlinkedEmails.outbound")}
            </span>
            {isIgnored ? (
              <span className="text-[11px] font-medium text-dash-text-muted bg-dash-surface-muted rounded-md px-1.5 py-0.5">
                {t("unlinkedEmails.statusIgnored")}
              </span>
            ) : null}
            {isLinked ? (
              <span className="text-[11px] font-medium text-[color:var(--dash-success-text)] bg-[color:var(--dash-success-bg)] rounded-md px-1.5 py-0.5">
                {t("unlinkedEmails.statusLinked")}
              </span>
            ) : null}
            {item.attachmentsCount > 0 ? (
              <span className="inline-flex items-center gap-1 text-[11px] text-dash-text-subtle">
                <Paperclip className="w-3 h-3" />
                {item.attachmentsCount}
              </span>
            ) : null}
          </div>
          <h3 className="text-sm font-semibold text-dash-text truncate">
            {item.subject || t("clientEmails.noSubject")}
          </h3>
          <p className="text-xs text-dash-text-muted truncate">
            <span className="text-dash-text-subtle">{t("unlinkedEmails.from")}: </span>
            {fromLabel}
          </p>
          <p className="text-xs text-dash-text-muted truncate">
            <span className="text-dash-text-subtle">{t("unlinkedEmails.to")}: </span>
            {toLabel}
          </p>
          {item.preview ? (
            <p className="text-[13px] text-dash-text-muted line-clamp-2 leading-relaxed">{item.preview}</p>
          ) : null}
        </div>
        <div className="text-right shrink-0 space-y-1">
          <p className="text-[11px] text-dash-text-subtle tabular-nums whitespace-nowrap">
            {formatDate(item.createdAt, lang)}
          </p>
          {item.accountEmail ? (
            <p className="text-[10px] text-dash-text-subtle truncate max-w-[9rem]" title={item.accountEmail}>
              {item.accountEmail}
            </p>
          ) : null}
          {item.externalUrl ? (
            <a
              href={item.externalUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-[11px] font-medium text-dash-accent hover:underline"
              data-testid={`unlinked-email-gmail-${item.id}`}
            >
              <ExternalLink className="w-3 h-3" />
              {t("unlinkedEmails.openGmail")}
            </a>
          ) : null}
        </div>
      </div>

      {inbound && !isIgnored ? (
        <CommunicationIntelligenceCard
          communicationId={item.id}
          compact
          testId={`unlinked-intelligence-${item.id}`}
        />
      ) : null}

      {suggestion && !isIgnored && !isLinked ? (
        <div
          className="rounded-lg border border-[color:var(--dash-info-border)] bg-dash-accent-soft px-3 py-2.5 space-y-2"
          data-testid={`unlinked-suggestion-${item.id}`}
        >
          <p className="text-sm text-dash-accent">
            {t("unlinkedEmails.suggestedClient").replace("{name}", suggestion.clientName)}
          </p>
          <p className="text-[11px] text-dash-text-muted">
            {[suggestion.email, suggestion.phone, suggestion.company].filter(Boolean).join(" · ")}
          </p>
          <div className="flex flex-wrap gap-2">
            <ActionButton
              variant="success"
              disabled={busy}
              onClick={() => onAcceptSuggestion?.(suggestion)}
              data-testid={`unlinked-accept-suggestion-${item.id}`}
            >
              {t("unlinkedEmails.acceptSuggestion")}
            </ActionButton>
            <ActionButton
              variant="quick"
              disabled={busy}
              onClick={() => onChooseOther?.()}
            >
              {t("unlinkedEmails.chooseOther")}
            </ActionButton>
            <ActionButton
              variant="ghost"
              disabled={busy}
              onClick={() => onDismissSuggestion?.()}
            >
              {t("unlinkedEmails.dismissSuggestion")}
            </ActionButton>
          </div>
        </div>
      ) : null}

      {!isLinked ? (
        <div className="flex flex-wrap gap-2 pt-0.5">
          {!isIgnored ? (
            <>
              <ActionButton
                variant="primary"
                className="h-9 text-sm"
                disabled={busy}
                onClick={() => onAssociate?.()}
                data-testid={`unlinked-associate-${item.id}`}
              >
                {t("unlinkedEmails.associate")}
              </ActionButton>
              <ActionButton
                variant="secondary"
                className="h-9 text-sm"
                disabled={busy}
                onClick={() => onCreateClient?.()}
                data-testid={`unlinked-create-client-${item.id}`}
              >
                {t("unlinkedEmails.createClient")}
              </ActionButton>
              <ActionButton
                variant="ghost"
                disabled={busy}
                onClick={() => onIgnore?.()}
                data-testid={`unlinked-ignore-${item.id}`}
              >
                {t("unlinkedEmails.ignore")}
              </ActionButton>
            </>
          ) : (
            <ActionButton
              variant="quick"
              disabled={busy}
              onClick={() => onRestore?.()}
              data-testid={`unlinked-restore-${item.id}`}
            >
              {t("unlinkedEmails.restore")}
            </ActionButton>
          )}
        </div>
      ) : null}
    </article>
  );
}
