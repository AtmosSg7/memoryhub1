import {
  FileText,
  FolderClosed,
  Receipt,
  StickyNote,
  Upload,
  User,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useDashboardLang } from "@/hooks/useDashboardLang";
import {
  formatEventTime,
  getEventIconType,
  getEventPresentation,
  getEventRoute,
} from "@/utils/eventDisplay";
import { InlineLoader, PageError } from "@/components/dashboard/PageFeedback";
import EmptyState from "@/components/dashboard/EmptyState";

const ICONS = {
  quote: { Icon: FileText, bg: "bg-[#EFF6FF]", color: "text-[#0A2540]" },
  invoice: { Icon: Receipt, bg: "bg-[#ECFDF5]", color: "text-[#065F46]" },
  note: { Icon: StickyNote, bg: "bg-[#FFFBEB]", color: "text-[#92400E]" },
  client: { Icon: User, bg: "bg-[#F3F4F6]", color: "text-[#4B5563]" },
  document: { Icon: FolderClosed, bg: "bg-[#EFF6FF]", color: "text-[#0A2540]" },
};

export default function CommercialTimeline({
  events,
  loading,
  error,
  limit,
  compact = false,
  muted = false,
  emptyLabel,
  testIdPrefix = "commercial-timeline",
}) {
  const { t, lang } = useDashboardLang();
  const navigate = useNavigate();
  const visible = limit ? events.slice(0, limit) : events;

  if (loading) {
    return (
      <InlineLoader
        label={t("activity.loading")}
        testId={`${testIdPrefix}-loading`}
        className="py-8"
      />
    );
  }

  if (error) {
    return <PageError message={error} testId={`${testIdPrefix}-error`} />;
  }

  if (!visible.length) {
    return emptyLabel ? (
      <EmptyState compact inline title={emptyLabel} testId={`${testIdPrefix}-empty`} />
    ) : null;
  }

  return (
    <ul
      className={`relative ${compact || muted ? "space-y-2" : "space-y-4"}`}
      data-testid={testIdPrefix}
    >
      <div className="absolute left-4 top-2 bottom-2 w-px bg-[#F3F4F6]" aria-hidden="true" />
      {visible.map((event) => {
        const iconType = getEventIconType(event.type);
        const meta = ICONS[iconType] ?? ICONS.client;
        const route = getEventRoute(event);
        const presentation = getEventPresentation(event, lang);
        const ItemTag = route ? "button" : "div";
        const contextLine = [presentation.clientName, presentation.amount].filter(Boolean);
        const TypeIcon = presentation.isImport ? Upload : meta.Icon;

        return (
          <li
            key={event.id}
            className="relative flex gap-3"
            data-testid={`${testIdPrefix}-item-${event.id}`}
          >
            <div className="relative z-10 w-8 h-8 rounded-lg flex items-center justify-center border border-[#E5E7EB] bg-white shadow-sm shrink-0">
              <div className={`w-6 h-6 rounded-md flex items-center justify-center ${meta.bg} ${meta.color}`}>
                <TypeIcon className="w-3.5 h-3.5" strokeWidth={2} />
              </div>
            </div>
            <ItemTag
              type={route ? "button" : undefined}
              onClick={route ? () => navigate(route) : undefined}
              className={[
                "flex-1 min-w-0 pt-0.5 text-left",
                route ? "cursor-pointer rounded-lg -m-1 p-1 hover:bg-[#F9FAFB] transition-colors" : "",
              ].join(" ")}
            >
              <div className="flex items-center justify-between gap-2">
                <span className={`font-medium text-[#111827] ${compact || muted ? "text-xs" : "text-[13px]"}`}>
                  {t(presentation.labelKey)}
                  {presentation.isImport ? (
                    <span className="text-[#6B7280] font-normal"> · {t("activity.viaImport")}</span>
                  ) : null}
                </span>
                <span className="text-[11px] text-[#9CA3AF] shrink-0 tabular-nums">
                  {formatEventTime(event.createdAt, lang)}
                </span>
              </div>
              {contextLine.length > 0 ? (
                <p className={`mt-0.5 font-medium text-[#0A2540] truncate ${compact || muted ? "text-[11px]" : "text-xs"}`}>
                  {contextLine.join(" · ")}
                </p>
              ) : null}
              {presentation.subtitle ? (
                <p
                  className={[
                    "mt-0.5 leading-snug truncate",
                    compact || muted ? "text-[11px] text-[#9CA3AF]" : "text-[12px] text-[#6B7280]",
                  ].join(" ")}
                >
                  {presentation.subtitle}
                </p>
              ) : null}
            </ItemTag>
          </li>
        );
      })}
    </ul>
  );
}
