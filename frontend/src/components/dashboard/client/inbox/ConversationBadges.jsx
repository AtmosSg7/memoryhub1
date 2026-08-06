import { memo } from "react";
import { Sparkles, ListChecks, Star } from "lucide-react";

function Chip({ children, className, testId }) {
  return (
    <span
      data-testid={testId}
      className={[
        "inline-flex items-center gap-0.5 rounded-md border px-1.5 py-0.5 text-[10px] font-medium",
        className,
      ].join(" ")}
    >
      {children}
    </span>
  );
}

function ConversationBadges({
  t,
  unreadCount = 0,
  priority,
  hasAction,
  hasIntel,
  isClient,
  isProspect,
  lifecycleStatus,
  compact = false,
}) {
  return (
    <div className={["flex flex-wrap items-center gap-1", compact ? "" : "mt-1"].join(" ")}>
      {unreadCount > 0 ? (
        <Chip
          testId="badge-unread"
          className="bg-dash-primary text-white border-transparent"
        >
          {unreadCount} {t("clientInbox.badges.unread")}
        </Chip>
      ) : lifecycleStatus === "read" || lifecycleStatus === "replied" ? (
        <Chip testId="badge-read" className="bg-dash-surface-muted text-dash-text-subtle border-dash-border-soft">
          {t("clientInbox.badges.read")}
        </Chip>
      ) : null}
      {priority === "high" || priority === "urgent" ? (
        <Chip
          testId="badge-important"
          className="bg-amber-50 text-amber-800 border-amber-100"
        >
          <Star className="w-3 h-3" />
          {t("clientInbox.badges.important")}
        </Chip>
      ) : null}
      {hasAction ? (
        <Chip testId="badge-action" className="bg-[#EEF2FF] text-[#3730A3] border-[#E0E7FF]">
          <ListChecks className="w-3 h-3" />
          {t("clientInbox.badges.action")}
        </Chip>
      ) : null}
      {hasIntel ? (
        <Chip testId="badge-intel" className="bg-[#F5F3FF] text-[#5B21B6] border-[#EDE9FE]">
          <Sparkles className="w-3 h-3" />
          {t("clientInbox.badges.intel")}
        </Chip>
      ) : null}
      {isClient ? (
        <Chip testId="badge-client" className="bg-[#ECFDF5] text-[#065F46] border-[#D1FAE5]">
          {t("clientInbox.badges.client")}
        </Chip>
      ) : null}
      {isProspect ? (
        <Chip testId="badge-prospect" className="bg-[#FFF7ED] text-[#9A3412] border-[#FFEDD5]">
          {t("clientInbox.badges.prospect")}
        </Chip>
      ) : null}
    </div>
  );
}

export default memo(ConversationBadges);
