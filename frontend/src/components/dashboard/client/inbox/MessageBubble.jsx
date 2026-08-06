import { memo } from "react";
import { ExternalLink } from "lucide-react";
import ConversationAvatar from "./ConversationAvatar";
import AttachmentChip from "./AttachmentChip";
import { formatSmartTime, messageAuthor } from "./inboxUtils";

function MessageBubble({ message, t, lang }) {
  const outbound = message.direction === "outbound";
  const author = messageAuthor(message);
  const unread =
    !outbound &&
    (message.lifecycleStatus === "to_read" || message.lifecycleStatus === "new");

  return (
    <div
      className={["flex gap-2", outbound ? "flex-row-reverse" : "flex-row"].join(" ")}
      data-testid={`client-inbox-msg-${message.id}`}
    >
      {!outbound ? (
        <ConversationAvatar name={author.name} email={author.email} size="sm" />
      ) : (
        <div className="w-8 shrink-0" />
      )}
      <div className={["max-w-[85%] sm:max-w-[75%]", outbound ? "items-end" : "items-start"].join(" ")}>
        <div
          className={[
            "rounded-2xl px-3.5 py-2.5 shadow-sm border",
            outbound
              ? "bg-dash-primary text-white border-transparent rounded-br-md"
              : "bg-dash-surface text-dash-text border-dash-border rounded-bl-md",
          ].join(" ")}
        >
          <div
            className={[
              "flex items-center justify-between gap-3 text-[10px] mb-1",
              outbound ? "text-white/80" : "text-dash-text-subtle",
            ].join(" ")}
          >
            <span className="truncate font-medium">
              {outbound ? t("clientInbox.you") : author.name || t("clientInbox.inbound")}
            </span>
            <span className="shrink-0">{formatSmartTime(message.createdAt, lang)}</span>
          </div>
          {message.subject ? (
            <p
              className={[
                "text-xs font-semibold mb-1",
                outbound ? "text-white" : "text-dash-text",
              ].join(" ")}
            >
              {message.subject}
            </p>
          ) : null}
          <p
            className={[
              "text-sm whitespace-pre-wrap break-words leading-relaxed",
              outbound ? "text-white/95" : "text-dash-text",
            ].join(" ")}
          >
            {message.preview || "—"}
          </p>
          {(message.attachments || []).length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {message.attachments.map((att) => (
                <AttachmentChip key={att.id} attachment={att} />
              ))}
            </div>
          ) : null}
        </div>
        <div
          className={[
            "mt-1 flex items-center gap-2 text-[10px]",
            outbound ? "justify-end text-dash-text-subtle" : "justify-start text-dash-text-subtle",
          ].join(" ")}
        >
          <span>
            {unread ? t("clientInbox.badges.unread") : t(`clientInbox.lifecycle.${message.lifecycleStatus}`)}
          </span>
          {message.externalUrl ? (
            <a
              href={message.externalUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-0.5 text-dash-primary min-h-8"
            >
              <ExternalLink className="w-3 h-3" />
              Gmail
            </a>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default memo(MessageBubble);
