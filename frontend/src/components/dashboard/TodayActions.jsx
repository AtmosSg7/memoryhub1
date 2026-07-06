import { useState } from "react";
import { FileText, Receipt, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useDashboardLang } from "@/hooks/useDashboardLang";
import { useAddQuote } from "@/context/AddQuoteContext";
import { useAddInvoice } from "@/context/AddInvoiceContext";
import { getTodayActions, getReminderIconType } from "@/utils/reminderGroups";
import {
  getReminderActionKey,
  getReminderDocType,
  parseReminderEntityId,
} from "@/utils/reminderActions";
import { getQuote } from "@/lib/quotesApi";
import { getInvoice, markInvoicePaid } from "@/lib/invoicesApi";
import CommercialDocumentDetailModal from "@/components/dashboard/CommercialDocumentDetailModal";
import FollowUpModal from "@/components/dashboard/FollowUpModal";
import { ActionButton } from "@/components/dashboard/ActionButton";

const TYPE_ICONS = {
  invoice: Receipt,
  quote: FileText,
  default: FileText,
};

const GROUP_STYLES = {
  critical: "border-[#FECACA] bg-[#FEF2F2] hover:bg-[#FEE2E2]",
  high: "border-[#FECACA] bg-[#FFF7F7] hover:bg-[#FEF2F2]",
  medium: "border-[#FDE68A] bg-[#FFFBEB] hover:bg-[#FEF3C7]",
  low: "border-[#E5E7EB] bg-[#FAFAFA] hover:bg-[#F3F4F6]",
};

const ACTION_VARIANTS = {
  collect: "success",
  followUp: "quick",
  view: "quick",
};

export default function TodayActions({ reminders, loading, error }) {
  const { t } = useDashboardLang();
  const { openEditQuote } = useAddQuote();
  const { openEditInvoice, notifyInvoicesChanged } = useAddInvoice();
  const actions = getTodayActions(reminders);

  const [loadingId, setLoadingId] = useState(null);
  const [actionId, setActionId] = useState(null);
  const [detailDoc, setDetailDoc] = useState(null);
  const [detailType, setDetailType] = useState(null);
  const [followUpDoc, setFollowUpDoc] = useState(null);
  const [followUpType, setFollowUpType] = useState(null);

  const fetchDocument = async (reminder) => {
    const entityId = parseReminderEntityId(reminder);
    const docType = getReminderDocType(reminder);
    if (!entityId || !docType) return null;
    return docType === "invoice" ? getInvoice(entityId) : getQuote(entityId);
  };

  const handleOpenDetail = async (reminder) => {
    setLoadingId(reminder.id);
    try {
      const doc = await fetchDocument(reminder);
      setDetailDoc(doc);
      setDetailType(getReminderDocType(reminder));
    } catch (err) {
      toast.error(err.message || t("dashboardV2.today.loadError"));
    } finally {
      setLoadingId(null);
    }
  };

  const handleQuickAction = async (event, reminder) => {
    event.stopPropagation();
    const actionKey = getReminderActionKey(reminder);
    setActionId(reminder.id);

    try {
      if (actionKey === "collect") {
        const entityId = parseReminderEntityId(reminder);
        const updated = await markInvoicePaid(entityId);
        notifyInvoicesChanged();
        toast.success(t("toast.invoiceMarkedPaid"), { description: updated.number });
        return;
      }

      if (actionKey === "followUp") {
        const doc = await fetchDocument(reminder);
        setFollowUpDoc(doc);
        setFollowUpType(getReminderDocType(reminder));
        return;
      }

      await handleOpenDetail(reminder);
    } catch (err) {
      toast.error(err.message || t("dashboardV2.today.actionError"));
    } finally {
      setActionId(null);
    }
  };

  const handleEditFromModal = (doc) => {
    setDetailDoc(null);
    if (detailType === "invoice") {
      openEditInvoice(doc);
    } else {
      openEditQuote(doc);
    }
  };

  const getActionLabel = (reminder) => {
    const key = getReminderActionKey(reminder);
    if (key === "collect") return t("actions.collect");
    if (key === "followUp") return t("actions.followUp");
    return t("actions.view");
  };

  if (!loading && !error && actions.length === 0) {
    return (
      <div
        data-testid="today-actions-empty"
        className="rounded-xl border border-[#A7F3D0] bg-[#ECFDF5] px-4 py-3 flex items-center gap-2"
      >
        <span aria-hidden="true">🟢</span>
        <p className="text-sm font-medium text-[#065F46]">{t("dashboardV2.summary.ok")}</p>
      </div>
    );
  }

  return (
    <>
      <div data-testid="today-actions-list" className="space-y-3">
        {loading ? (
          <div className="flex items-center justify-center py-6 text-[#6B7280]">
            <Loader2 className="w-5 h-5 animate-spin" />
          </div>
        ) : error ? (
          <p className="text-sm text-[#991B1B] py-4">{error}</p>
        ) : (
          <ul className="space-y-2">
            {actions.map((reminder) => {
              const Icon = TYPE_ICONS[getReminderIconType(reminder.type)] || FileText;
              const cardStyle = GROUP_STYLES[reminder.priority] || GROUP_STYLES.medium;
              const isLoading = loadingId === reminder.id;
              const isActing = actionId === reminder.id;

              return (
                <li key={reminder.id}>
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => !isLoading && !isActing && handleOpenDetail(reminder)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        if (!isLoading && !isActing) handleOpenDetail(reminder);
                      }
                    }}
                    data-testid={`priority-reminder-${reminder.id}`}
                    className={[
                      "w-full flex items-center gap-3 p-4 rounded-xl border transition-colors text-left cursor-pointer",
                      cardStyle,
                    ].join(" ")}
                  >
                    <div className="w-9 h-9 rounded-lg bg-white/70 flex items-center justify-center shrink-0">
                      {isLoading ? (
                        <Loader2 className="w-4 h-4 animate-spin text-[#6B7280]" />
                      ) : (
                        <Icon className="w-4 h-4 text-[#111827]" strokeWidth={1.75} />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[14px] font-semibold text-[#111827] truncate">{reminder.title}</p>
                    </div>
                    <ActionButton
                      variant={ACTION_VARIANTS[getReminderActionKey(reminder)] || "quick"}
                      disabled={isLoading || isActing}
                      onClick={(e) => handleQuickAction(e, reminder)}
                      data-testid={`today-action-btn-${reminder.id}`}
                    >
                      {isActing ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        getActionLabel(reminder)
                      )}
                    </ActionButton>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {!loading && !error && reminders.length > actions.length && (
          <p className="text-xs text-[#9CA3AF] text-center">
            {t("dashboardV2.today.more").replace("{count}", String(reminders.length - actions.length))}
          </p>
        )}
      </div>

      <CommercialDocumentDetailModal
        type={detailType}
        document={detailDoc}
        open={Boolean(detailDoc)}
        onOpenChange={(open) => !open && setDetailDoc(null)}
        onEdit={handleEditFromModal}
      />

      {followUpDoc && followUpType ? (
        <FollowUpModal
          entityType={followUpType}
          entityId={followUpDoc.id}
          open={Boolean(followUpDoc)}
          onOpenChange={(open) => !open && setFollowUpDoc(null)}
        />
      ) : null}
    </>
  );
}
