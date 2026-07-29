import { useState } from "react";
import { toast } from "sonner";
import { toastApiError } from "@/utils/apiErrors";
import { useDashboardLang } from "@/hooks/useDashboardLang";
import {
  associateCommunication,
  createClientFromEmail,
  dismissEmailSuggestion,
  getEmailClientPrefill,
  ignoreCommunication,
  restoreCommunication,
} from "@/lib/communicationsApi";
import UnlinkedEmailCard from "@/components/communications/UnlinkedEmailCard";
import AssociateClientModal from "@/components/communications/AssociateClientModal";
import CreateClientFromEmailModal from "@/components/communications/CreateClientFromEmailModal";
import { PageError, PageLoader, InlineLoader } from "@/components/dashboard/PageFeedback";
import EmptyState from "@/components/dashboard/EmptyState";
import { ActionButton } from "@/components/dashboard/ActionButton";
import { Inbox } from "lucide-react";

export default function UnlinkedEmailsInbox({
  items,
  total,
  loading,
  loadingMore,
  error,
  hasMore,
  onLoadMore,
  onChanged,
  emptyLabel,
}) {
  const { t } = useDashboardLang();
  const [busyId, setBusyId] = useState(null);
  const [associateTarget, setAssociateTarget] = useState(null);
  const [createTarget, setCreateTarget] = useState(null);
  const [prefill, setPrefill] = useState(null);
  const [prefillLoading, setPrefillLoading] = useState(false);

  const run = async (id, fn, successKey) => {
    setBusyId(id);
    try {
      await fn();
      if (successKey) toast.success(t(successKey));
      await onChanged?.();
    } catch (err) {
      toastApiError(err, t, "unlinkedEmails.actionError");
    } finally {
      setBusyId(null);
    }
  };

  const openCreate = async (item) => {
    setCreateTarget(item);
    setPrefillLoading(true);
    try {
      const data = await getEmailClientPrefill(item.id);
      setPrefill(data);
    } catch (err) {
      toastApiError(err, t, "unlinkedEmails.actionError");
      setCreateTarget(null);
    } finally {
      setPrefillLoading(false);
    }
  };

  if (loading) {
    return <PageLoader label={t("unlinkedEmails.loading")} compact testId="unlinked-emails-loading" />;
  }

  if (error) {
    return (
      <div className="p-4">
        <PageError message={error} testId="unlinked-emails-error" />
      </div>
    );
  }

  if (!items.length) {
    return (
      <EmptyState
        icon={Inbox}
        title={t("unlinkedEmails.emptyTitle")}
        description={emptyLabel || t("unlinkedEmails.empty")}
        testId="unlinked-emails-empty"
        compact
        inline
      />
    );
  }

  return (
    <div className="p-4 space-y-3" data-testid="unlinked-emails-inbox">
      <p className="text-[11px] text-[#9CA3AF]">
        {t("unlinkedEmails.count").replace("{count}", String(items.length)).replace("{total}", String(total))}
      </p>

      {items.map((item) => (
        <UnlinkedEmailCard
          key={item.id}
          item={item}
          busy={busyId === item.id}
          onAssociate={() => setAssociateTarget(item)}
          onChooseOther={() => setAssociateTarget(item)}
          onCreateClient={() => openCreate(item)}
          onIgnore={() =>
            run(item.id, () => ignoreCommunication(item.id), "unlinkedEmails.toastIgnored")
          }
          onRestore={() =>
            run(item.id, () => restoreCommunication(item.id), "unlinkedEmails.toastRestored")
          }
          onAcceptSuggestion={(suggestion) =>
            run(
              item.id,
              () => associateCommunication(item.id, suggestion.clientId),
              "unlinkedEmails.toastAssociated"
            )
          }
          onDismissSuggestion={() =>
            run(item.id, () => dismissEmailSuggestion(item.id), "unlinkedEmails.toastSuggestionDismissed")
          }
        />
      ))}

      {hasMore ? (
        <div className="pt-2 flex justify-center">
          {loadingMore ? (
            <InlineLoader label={t("unlinkedEmails.loadingMore")} className="py-2" />
          ) : (
            <ActionButton variant="secondary" onClick={onLoadMore} data-testid="unlinked-load-more">
              {t("unlinkedEmails.loadMore")}
            </ActionButton>
          )}
        </div>
      ) : null}

      <AssociateClientModal
        open={Boolean(associateTarget)}
        onClose={() => setAssociateTarget(null)}
        submitting={busyId === associateTarget?.id}
        onConfirm={async (client) => {
          if (!associateTarget) return;
          await run(
            associateTarget.id,
            () => associateCommunication(associateTarget.id, client.id),
            "unlinkedEmails.toastAssociated"
          );
          setAssociateTarget(null);
        }}
      />

      <CreateClientFromEmailModal
        open={Boolean(createTarget)}
        loading={prefillLoading}
        prefill={prefill}
        onClose={() => {
          setCreateTarget(null);
          setPrefill(null);
        }}
        submitting={busyId === createTarget?.id}
        onConfirm={async (payload) => {
          if (!createTarget) return;
          await run(
            createTarget.id,
            async () => {
              const result = await createClientFromEmail(createTarget.id, payload);
              if (result.duplicateClientId) {
                toast.message(t("unlinkedEmails.toastDuplicateLinked"));
              }
            },
            "unlinkedEmails.toastClientCreated"
          );
          setCreateTarget(null);
          setPrefill(null);
        }}
      />
    </div>
  );
}
