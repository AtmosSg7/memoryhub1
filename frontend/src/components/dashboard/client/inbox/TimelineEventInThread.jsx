import { memo } from "react";
import { useNavigate } from "react-router-dom";
import { FileText, FolderClosed, Receipt, StickyNote } from "lucide-react";
import { formatAmountCents, timelineItemRoute } from "@/utils/clientTimelineV2";
import { formatSmartTime } from "./inboxUtils";

function iconFor(event) {
  if (event.entityType === "invoice" || String(event.type || "").startsWith("invoice_")) {
    return Receipt;
  }
  if (event.entityType === "quote" || String(event.type || "").startsWith("quote_")) {
    return FileText;
  }
  if (event.category === "notes") return StickyNote;
  if (event.category === "documents") return FolderClosed;
  return FileText;
}

function TimelineEventInThread({ event, clientId, t, lang }) {
  const navigate = useNavigate();
  const Icon = iconFor(event);
  const amount = formatAmountCents(event.amountCents, lang);
  const route = timelineItemRoute(event, clientId);

  return (
    <div className="flex justify-center py-1" data-testid={`thread-event-${event.id}`}>
      <button
        type="button"
        onClick={() => {
          if (route) navigate(route);
        }}
        className="inline-flex items-center gap-2 rounded-full border border-dash-border bg-dash-surface-muted/80 px-3 py-1.5 text-[11px] text-dash-text-muted hover:bg-dash-bg transition-colors max-w-full"
      >
        <Icon className="w-3.5 h-3.5 shrink-0 text-dash-primary" />
        <span className="font-medium text-dash-text truncate">
          {event.title || t("clientInbox.threadEvent")}
        </span>
        {amount ? <span className="text-dash-text-subtle shrink-0">{amount}</span> : null}
        <span className="text-dash-text-subtle shrink-0">
          {formatSmartTime(event.createdAt, lang)}
        </span>
      </button>
    </div>
  );
}

export default memo(TimelineEventInThread);
