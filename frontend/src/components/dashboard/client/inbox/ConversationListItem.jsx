import { memo } from "react";
import { Mail, Paperclip } from "lucide-react";
import ConversationAvatar from "./ConversationAvatar";
import ConversationBadges from "./ConversationBadges";
import { formatSmartTime } from "./inboxUtils";

function ConversationListItem({
  conversation: conv,
  active,
  onSelect,
  t,
  lang,
}) {
  const participant = conv._participant || {};
  const name = participant.name || conv.clientName || t("clientInbox.noSubject");
  const email = participant.email;

  return (
    <button
      type="button"
      onClick={() => onSelect(conv.id)}
      className={[
        "group w-full text-left rounded-xl border px-3 py-3 transition-all min-h-[88px]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dash-primary/30",
        active
          ? "border-dash-primary/30 bg-dash-accent-soft/40 shadow-sm"
          : "border-dash-border bg-dash-surface hover:border-dash-border hover:bg-dash-bg hover:shadow-sm",
      ].join(" ")}
      data-testid={`client-inbox-conv-${conv.id}`}
    >
      <div className="flex items-start gap-3">
        <ConversationAvatar name={name} email={email} />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-dash-text truncate">{name}</p>
              {email ? (
                <p className="text-[11px] text-dash-text-subtle truncate">{email}</p>
              ) : null}
            </div>
            <div className="shrink-0 text-right">
              <p className="text-[11px] text-dash-text-subtle">
                {formatSmartTime(conv.lastMessageAt, lang)}
              </p>
              {conv.unreadCount > 0 ? (
                <span
                  className="mt-1 inline-flex min-w-[1.25rem] justify-center rounded-full bg-dash-primary px-1.5 py-0.5 text-[10px] font-semibold text-white"
                  data-testid={`client-inbox-unread-${conv.id}`}
                >
                  {conv.unreadCount}
                </span>
              ) : null}
            </div>
          </div>

          <p className="text-xs font-medium text-dash-text line-clamp-1 mt-1">
            {conv.subject || t("clientInbox.noSubject")}
          </p>
          <p className="text-xs text-dash-text-muted line-clamp-1 mt-0.5">
            {conv.preview || "—"}
          </p>

          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1.5 text-[11px] text-dash-text-subtle">
            <span className="inline-flex items-center gap-1">
              <Mail className="w-3 h-3" />
              {t(`clientInbox.channels.${conv.channel}`) !== `clientInbox.channels.${conv.channel}`
                ? t(`clientInbox.channels.${conv.channel}`)
                : conv.channel}
            </span>
            <span>·</span>
            <span>
              {conv.messageCount} {t("clientInbox.messages")}
            </span>
            {conv.attachmentCount > 0 ? (
              <>
                <span>·</span>
                <span className="inline-flex items-center gap-0.5">
                  <Paperclip className="w-3 h-3" />
                  {conv.attachmentCount}
                </span>
              </>
            ) : null}
            {conv.priority && conv.priority !== "normal" ? (
              <>
                <span>·</span>
                <span>{t(`clientInbox.priority.${conv.priority}`)}</span>
              </>
            ) : null}
          </div>

          <ConversationBadges
            t={t}
            unreadCount={0}
            priority={conv.priority}
            hasAction={conv._hasAction}
            hasIntel={conv._hasIntel}
            isClient={conv._isClient}
            isProspect={conv._isProspect}
            lifecycleStatus={conv.lifecycleStatus}
            compact
          />
        </div>
      </div>
    </button>
  );
}

export default memo(ConversationListItem);
