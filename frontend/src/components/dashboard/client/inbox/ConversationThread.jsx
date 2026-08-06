import { memo, useMemo } from "react";
import MessageBubble from "./MessageBubble";
import TimelineEventInThread from "./TimelineEventInThread";
import AttachmentChip from "./AttachmentChip";
import { buildHybridThreadRows } from "./inboxUtils";

function dayLabel(bucket, t) {
  const key = `clientInbox.days.${bucket}`;
  const label = t(key);
  return label === key ? bucket : label;
}

function ConversationThread({
  conversation,
  messages,
  attachments,
  timelineItems,
  clientId,
  t,
  lang,
}) {
  const rows = useMemo(
    () => buildHybridThreadRows(messages, timelineItems, conversation, lang),
    [messages, timelineItems, conversation, lang],
  );

  return (
    <div className="flex flex-col gap-3" data-testid="conversation-thread">
      {rows.map((row) => {
        if (row.kind === "day") {
          return (
            <div
              key={row.id}
              className="flex items-center gap-3 py-1"
              data-testid={`thread-day-${row.bucket}`}
            >
              <div className="h-px flex-1 bg-dash-border-soft" />
              <span className="text-[10px] font-semibold uppercase tracking-wider text-dash-text-subtle">
                {dayLabel(row.bucket, t)}
              </span>
              <div className="h-px flex-1 bg-dash-border-soft" />
            </div>
          );
        }
        if (row.kind === "event") {
          return (
            <TimelineEventInThread
              key={row.id}
              event={row.event}
              clientId={clientId}
              t={t}
              lang={lang}
            />
          );
        }
        return (
          <MessageBubble key={row.id} message={row.message} t={t} lang={lang} />
        );
      })}

      {(attachments || []).length > 0 ? (
        <div className="mt-2 pt-3 border-t border-dash-border-soft">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-dash-text-subtle mb-2">
            {t("clientInbox.attachments")}
          </p>
          <div className="flex flex-wrap gap-2">
            {attachments.map((att) => (
              <AttachmentChip key={att.id} attachment={att} />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default memo(ConversationThread);
