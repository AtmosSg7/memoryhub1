import { memo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Calendar,
  Check,
  ExternalLink,
  FileText,
  FolderClosed,
  ListChecks,
  Mail,
  MailOpen,
  MessageCircle,
  Phone,
  Receipt,
  StickyNote,
} from "lucide-react";
import { toast } from "sonner";
import { useDashboardLang } from "@/hooks/useDashboardLang";
import { ActionButton } from "@/components/dashboard/ActionButton";
import { completeAction } from "@/lib/actionsApi";
import {
  formatAmountCents,
  formatCardTime,
  formatRelativeDay,
  timelineItemRoute,
} from "@/utils/clientTimelineV2";

const ICON_BY_CATEGORY = {
  communications: Mail,
  commercial: FileText,
  actions: ListChecks,
  notes: StickyNote,
  documents: FolderClosed,
};

function iconForItem(item) {
  if (item.type === "email_received") return MailOpen;
  if (item.type === "email_sent") return Mail;
  if (item.type === "whatsapp_message") return MessageCircle;
  if (item.type === "call_logged") return Phone;
  if (item.type === "calendar_event_synced") return Calendar;
  if (item.entityType === "invoice" || String(item.type || "").startsWith("invoice_")) {
    return Receipt;
  }
  if (item.entityType === "quote" || String(item.type || "").startsWith("quote_")) {
    return FileText;
  }
  return ICON_BY_CATEGORY[item.category] || FileText;
}

const URGENCY_CLASS = {
  urgent: "bg-red-50 text-red-700 border-red-100",
  high: "bg-amber-50 text-amber-800 border-amber-100",
  normal: "bg-dash-surface-muted text-dash-text-muted border-dash-border-soft",
  low: "bg-dash-surface-muted text-dash-text-subtle border-dash-border-soft",
};

function Badge({ children, className = "" }) {
  return (
    <span
      className={[
        "inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-medium",
        className,
      ].join(" ")}
    >
      {children}
    </span>
  );
}

function TimelineV2Card({ item, clientId, compact = false, onActionDone }) {
  const { t, lang } = useDashboardLang();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const Icon = iconForItem(item);
  const route = timelineItemRoute(item, clientId);
  const intel = item.intelligence;
  const amount = formatAmountCents(item.amountCents, lang);
  const meta = item.metadata || {};

  const handleOpen = () => {
    if (item.externalUrl && (item.kind === "communication" || item.category === "communications")) {
      window.open(item.externalUrl, "_blank", "noopener,noreferrer");
      return;
    }
    if (route) navigate(route);
  };

  const handleComplete = async (e) => {
    e.stopPropagation();
    if (busy || item.actionStatus !== "pending") return;
    setBusy(true);
    try {
      await completeAction(item.entityId);
      toast.success(t("dashboardV2.engine.toastCompleted"));
      onActionDone?.();
    } catch (err) {
      toast.error(err?.message || t("dashboardV2.today.actionError"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <article
      className={[
        "rounded-xl border border-dash-border-soft bg-dash-surface px-3.5 sm:px-4 transition-colors",
        compact ? "py-2.5" : "py-3.5",
        "hover:border-dash-border hover:bg-dash-surface-muted/40",
      ].join(" ")}
      data-testid={`timeline-v2-card-${item.id}`}
    >
      <div className="flex items-start gap-3">
        <div
          className={[
            "shrink-0 rounded-lg border border-dash-border bg-dash-surface-muted flex items-center justify-center text-dash-text-muted",
            compact ? "w-8 h-8" : "w-9 h-9",
          ].join(" ")}
        >
          <Icon className={compact ? "w-3.5 h-3.5" : "w-4 h-4"} strokeWidth={2} />
        </div>

        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3
                className={[
                  "font-medium text-dash-text leading-snug",
                  compact ? "text-[13px]" : "text-sm",
                ].join(" ")}
              >
                {item.title || t("timelineV2.untitled")}
              </h3>
              <p className="text-[11px] text-dash-text-subtle tabular-nums mt-0.5">
                {formatRelativeDay(item.createdAt, lang)}
                {item.createdAt ? ` · ${formatCardTime(item.createdAt, lang)}` : ""}
              </p>
            </div>
            <div className="flex flex-wrap justify-end gap-1 shrink-0 max-w-[40%]">
              {item.badges?.includes("prospect") ? (
                <Badge className="border-amber-200 bg-amber-50 text-amber-800">
                  {t("timelineV2.badge.prospect")}
                </Badge>
              ) : null}
              {item.badges?.includes("client") ? (
                <Badge className="border-dash-border-soft bg-dash-surface-muted text-dash-text-muted">
                  {t("timelineV2.badge.client")}
                </Badge>
              ) : null}
              {item.badges?.includes("overdue") ? (
                <Badge className="border-red-100 bg-red-50 text-red-700">
                  {t("timelineV2.badge.overdue")}
                </Badge>
              ) : null}
              {item.status && item.category === "commercial" ? (
                <Badge className="border-dash-border-soft bg-dash-surface-muted text-dash-text-muted">
                  {item.status}
                </Badge>
              ) : null}
            </div>
          </div>

          {/* Communication + CI */}
          {(item.kind === "communication" || item.category === "communications") && (
            <div className="space-y-1">
              {(meta.fromName || meta.fromEmail) && (
                <p className="text-xs text-dash-text-muted truncate">
                  <span className="text-dash-text-subtle">{t("timelineV2.from")}: </span>
                  {meta.fromName || meta.fromEmail}
                  {meta.fromName && meta.fromEmail ? ` · ${meta.fromEmail}` : ""}
                </p>
              )}
              {intel?.summary || item.summary ? (
                <p className={["text-dash-text leading-relaxed", compact ? "text-xs line-clamp-2" : "text-[13px] line-clamp-3"].join(" ")}>
                  {intel?.summary || item.summary}
                </p>
              ) : null}
              <div className="flex flex-wrap gap-1.5 pt-0.5">
                {intel?.intent ? (
                  <Badge className="border-[color:var(--dash-info-border)] bg-dash-accent-soft text-dash-accent">
                    {t(`commIntelligence.intent.${intel.intent}`)}
                  </Badge>
                ) : null}
                {intel?.urgency ? (
                  <Badge className={URGENCY_CLASS[intel.urgency] || URGENCY_CLASS.normal}>
                    {t(`commIntelligence.urgency.${intel.urgency}`)}
                  </Badge>
                ) : null}
              </div>
              {intel?.suggestedActionTitle && intel?.suggestionStatus === "pending" ? (
                <p className="text-xs font-medium text-dash-text">
                  {t("commIntelligence.suggestedAction")}: {intel.suggestedActionTitle}
                </p>
              ) : null}
            </div>
          )}

          {/* Notes — show text directly */}
          {item.category === "notes" && item.summary ? (
            <p className={["text-dash-text leading-relaxed whitespace-pre-wrap", compact ? "text-xs line-clamp-3" : "text-[13px] line-clamp-4"].join(" ")}>
              {item.summary}
            </p>
          ) : null}

          {/* Commercial */}
          {item.category === "commercial" && (
            <div className="flex flex-wrap items-center gap-2 text-xs text-dash-text-muted">
              {amount ? (
                <span className="font-semibold text-dash-text tabular-nums">{amount}</span>
              ) : null}
              {item.summary && !amount ? (
                <span className="line-clamp-2">{item.summary}</span>
              ) : null}
            </div>
          )}

          {/* Actions */}
          {item.kind === "action" || item.category === "actions" ? (
            <div className="space-y-1">
              {item.summary ? (
                <p className="text-xs text-dash-text-muted line-clamp-2">{item.summary}</p>
              ) : null}
              <div className="flex flex-wrap gap-1.5">
                {item.priority ? (
                  <Badge className="border-dash-border-soft bg-dash-surface-muted text-dash-text-muted">
                    {t(`dashboardV2.engine.priority.${item.priority}`)}
                  </Badge>
                ) : null}
                {item.actionStatus ? (
                  <Badge className="border-dash-border-soft bg-dash-surface-muted text-dash-text-muted">
                    {item.actionStatus}
                  </Badge>
                ) : null}
              </div>
            </div>
          ) : null}

          {/* Documents / default summary */}
          {item.category === "documents" && item.summary ? (
            <p className="text-xs text-dash-text-muted truncate">{item.summary}</p>
          ) : null}

          <div className="flex flex-wrap gap-2 pt-1">
            <ActionButton
              variant="quick"
              className="min-h-11 gap-1 md:min-h-9"
              onClick={handleOpen}
              data-testid={`timeline-v2-open-${item.id}`}
            >
              {item.externalUrl && item.category === "communications" ? (
                <ExternalLink className="w-3.5 h-3.5" />
              ) : null}
              {t("timelineV2.open")}
            </ActionButton>
            {(item.kind === "action" || item.category === "actions") &&
            item.actionStatus === "pending" ? (
              <ActionButton
                variant="success"
                className="min-h-11 gap-1 md:min-h-9"
                disabled={busy}
                onClick={handleComplete}
                data-testid={`timeline-v2-complete-${item.id}`}
              >
                <Check className="w-3.5 h-3.5" />
                {t("dashboardV2.engine.complete")}
              </ActionButton>
            ) : null}
          </div>
        </div>
      </div>
    </article>
  );
}

export default memo(TimelineV2Card);
