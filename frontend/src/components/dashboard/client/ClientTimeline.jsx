import { useNavigate } from "react-router-dom";
import { useDashboardLang } from "@/hooks/useDashboardLang";
import { getEventIconType } from "@/utils/eventDisplay";
import {
  buildTimelineRows,
  sortEventsNewestFirst,
} from "@/utils/clientTimeline";
import { getTimelineItemPresentation } from "@/utils/clientTimelinePresentation";
import { InlineLoader, PageError } from "@/components/dashboard/PageFeedback";
import EmptyState from "@/components/dashboard/EmptyState";
import {
  Calendar,
  FileText,
  FolderClosed,
  Mail,
  MessageCircle,
  Phone,
  Receipt,
  Send,
  StickyNote,
  Upload,
  User,
  Users,
  RefreshCw,
} from "lucide-react";

const ICONS = {
  quote: { Icon: FileText, bg: "bg-[#EFF6FF]", color: "text-[#0A2540]" },
  invoice: { Icon: Receipt, bg: "bg-[#ECFDF5]", color: "text-[#065F46]" },
  note: { Icon: StickyNote, bg: "bg-[#FFFBEB]", color: "text-[#92400E]" },
  client: { Icon: User, bg: "bg-[#F3F4F6]", color: "text-[#4B5563]" },
  document: { Icon: FolderClosed, bg: "bg-[#EFF6FF]", color: "text-[#0A2540]" },
  follow_up: { Icon: RefreshCw, bg: "bg-[#FFF7ED]", color: "text-[#C2410C]" },
  send: { Icon: Send, bg: "bg-[#EFF6FF]", color: "text-[#0A2540]" },
  call: { Icon: Phone, bg: "bg-[#F3F4F6]", color: "text-[#4B5563]" },
  email: { Icon: Mail, bg: "bg-[#EFF6FF]", color: "text-[#0A2540]" },
  whatsapp: { Icon: MessageCircle, bg: "bg-[#ECFDF5]", color: "text-[#065F46]" },
  calendar: { Icon: Calendar, bg: "bg-[#F5F3FF]", color: "text-[#5B21B6]" },
  contacts: { Icon: Users, bg: "bg-[#F3F4F6]", color: "text-[#4B5563]" },
};

export default function ClientTimeline({
  events,
  loading,
  error,
  emptyLabel,
  limit,
  compact = false,
  hasMore = false,
  loadingMore = false,
  onLoadMore,
  testId = "client-timeline",
}) {
  const { t, lang } = useDashboardLang();
  const navigate = useNavigate();

  const sorted = sortEventsNewestFirst(events);
  const visibleEvents = limit ? sorted.slice(0, limit) : sorted;
  const rows = buildTimelineRows(visibleEvents, { lang });

  if (loading) {
    return (
      <InlineLoader
        label={t("activity.loading")}
        testId={`${testId}-loading`}
        className="py-8"
      />
    );
  }

  if (error) {
    return <PageError message={error} testId={`${testId}-error`} />;
  }

  if (!visibleEvents.length) {
    return emptyLabel ? (
      <EmptyState compact inline title={emptyLabel} testId={`${testId}-empty`} />
    ) : null;
  }

  return (
    <div className="space-y-3" data-testid={testId}>
      <ul className={`relative ${compact ? "space-y-2" : "space-y-3"}`}>
        <div
          className="absolute left-[15px] top-3 bottom-3 w-px bg-[#E5E7EB]"
          aria-hidden="true"
        />

        {rows.map((row) => {
          if (row.kind === "day") {
            return (
              <li
                key={row.id}
                className="relative z-10 flex items-center gap-3 py-1"
                data-testid={`${testId}-day-${row.dayKey}`}
              >
                <div className="w-8 shrink-0" aria-hidden="true" />
                <div className="flex-1 flex items-center gap-2 min-w-0">
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-[#9CA3AF]">
                    {row.label}
                  </span>
                  <div className="flex-1 h-px bg-[#F3F4F6]" />
                </div>
              </li>
            );
          }

          const presentation = getTimelineItemPresentation(row, lang, t);
          const iconType =
            presentation.iconType ||
            getEventIconType(row.kind === "group" ? row.type : row.event?.type);
          const meta = ICONS[iconType] ?? ICONS.client;
          const TypeIcon = presentation.isImport ? Upload : meta.Icon;
          const route = presentation.route;
          const ItemTag = route ? "button" : "div";
          const dt = row.dateTime || {};

          return (
            <li
              key={row.id}
              className="relative flex gap-3"
              data-testid={
                row.kind === "group"
                  ? `${testId}-group-${row.type}-${row.count}`
                  : `${testId}-item-${row.event.id}`
              }
            >
              <div className="relative z-10 w-8 h-8 rounded-lg flex items-center justify-center border border-[#E5E7EB] bg-white shadow-sm shrink-0">
                <div
                  className={`w-6 h-6 rounded-md flex items-center justify-center ${meta.bg} ${meta.color}`}
                >
                  <TypeIcon className="w-3.5 h-3.5" strokeWidth={2} />
                </div>
              </div>

              <ItemTag
                type={route ? "button" : undefined}
                onClick={route ? () => navigate(route) : undefined}
                className={[
                  "flex-1 min-w-0 rounded-xl border border-[#F3F4F6] bg-[#FAFAFA] px-3 py-2.5 text-left transition-colors",
                  route ? "cursor-pointer hover:border-[#E5E7EB] hover:bg-white" : "",
                  compact ? "py-2" : "",
                ].join(" ")}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div
                      className={[
                        "font-medium text-[#111827] truncate",
                        compact ? "text-xs" : "text-[13px]",
                      ].join(" ")}
                    >
                      {presentation.title}
                    </div>
                    {presentation.description ? (
                      <p
                        className={[
                          "mt-0.5 leading-snug line-clamp-2",
                          compact ? "text-[11px] text-[#9CA3AF]" : "text-[12px] text-[#6B7280]",
                        ].join(" ")}
                      >
                        {presentation.description}
                      </p>
                    ) : null}
                  </div>
                  <div className="shrink-0 text-right tabular-nums">
                    <div className="text-[11px] text-[#6B7280]">{dt.date}</div>
                    <div className="text-[10px] text-[#9CA3AF]">{dt.time}</div>
                  </div>
                </div>
              </ItemTag>
            </li>
          );
        })}
      </ul>

      {hasMore && onLoadMore ? (
        <div className="pt-1 pl-11">
          <button
            type="button"
            onClick={onLoadMore}
            disabled={loadingMore}
            data-testid={`${testId}-load-more`}
            className="text-xs font-medium text-[#0A2540] hover:underline disabled:opacity-50"
          >
            {loadingMore ? t("activity.loading") : t("clientTimeline.loadMore")}
          </button>
        </div>
      ) : null}
    </div>
  );
}
