import { ExternalLink, Mail, MailOpen, Paperclip } from "lucide-react";
import { useDashboardLang } from "@/hooks/useDashboardLang";
import { ActionButton } from "@/components/dashboard/ActionButton";

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
      className="rounded-xl border border-[#E5E7EB] bg-white px-4 py-3 space-y-3"
      data-testid={`unlinked-email-${item.id}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#4B5563] bg-[#F3F4F6] rounded-md px-1.5 py-0.5">
              <DirectionIcon className="w-3 h-3" />
              {inbound ? t("unlinkedEmails.inbound") : t("unlinkedEmails.outbound")}
            </span>
            {isIgnored ? (
              <span className="text-[11px] font-medium text-[#6B7280] bg-[#F3F4F6] rounded-md px-1.5 py-0.5">
                {t("unlinkedEmails.statusIgnored")}
              </span>
            ) : null}
            {isLinked ? (
              <span className="text-[11px] font-medium text-emerald-800 bg-emerald-50 rounded-md px-1.5 py-0.5">
                {t("unlinkedEmails.statusLinked")}
              </span>
            ) : null}
            {item.attachmentsCount > 0 ? (
              <span className="inline-flex items-center gap-1 text-[11px] text-[#9CA3AF]">
                <Paperclip className="w-3 h-3" />
                {item.attachmentsCount}
              </span>
            ) : null}
          </div>
          <h3 className="text-sm font-semibold text-[#111827] truncate">
            {item.subject || t("clientEmails.noSubject")}
          </h3>
          <p className="text-xs text-[#6B7280] truncate">
            <span className="text-[#9CA3AF]">{t("unlinkedEmails.from")}: </span>
            {fromLabel}
          </p>
          <p className="text-xs text-[#6B7280] truncate">
            <span className="text-[#9CA3AF]">{t("unlinkedEmails.to")}: </span>
            {toLabel}
          </p>
          {item.preview ? (
            <p className="text-[13px] text-[#4B5563] line-clamp-2 leading-relaxed">{item.preview}</p>
          ) : null}
        </div>
        <div className="text-right shrink-0 space-y-1">
          <p className="text-[11px] text-[#9CA3AF] tabular-nums whitespace-nowrap">
            {formatDate(item.createdAt, lang)}
          </p>
          {item.accountEmail ? (
            <p className="text-[10px] text-[#9CA3AF] truncate max-w-[9rem]" title={item.accountEmail}>
              {item.accountEmail}
            </p>
          ) : null}
          {item.externalUrl ? (
            <a
              href={item.externalUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-[11px] font-medium text-[#0A2540] hover:underline"
              data-testid={`unlinked-email-gmail-${item.id}`}
            >
              <ExternalLink className="w-3 h-3" />
              {t("unlinkedEmails.openGmail")}
            </a>
          ) : null}
        </div>
      </div>

      {suggestion && !isIgnored && !isLinked ? (
        <div
          className="rounded-lg border border-[#BFDBFE] bg-[#EFF6FF] px-3 py-2.5 space-y-2"
          data-testid={`unlinked-suggestion-${item.id}`}
        >
          <p className="text-sm text-[#0A2540]">
            {t("unlinkedEmails.suggestedClient").replace("{name}", suggestion.clientName)}
          </p>
          <p className="text-[11px] text-[#6B7280]">
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
