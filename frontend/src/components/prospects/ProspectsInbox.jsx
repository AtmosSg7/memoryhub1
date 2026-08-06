import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { UserPlus } from "lucide-react";
import { useDashboardLang } from "@/hooks/useDashboardLang";
import { toastApiError } from "@/utils/apiErrors";
import {
  associateProspect,
  createClientFromProspect,
  ignoreProspect,
  restoreProspect,
} from "@/lib/prospectsApi";
import { invalidateProspectsPendingCount } from "@/hooks/useProspectsPendingCount";
import { invalidateActionsPendingCount } from "@/hooks/useActionsCountInvalidate";
import ProspectCard from "@/components/prospects/ProspectCard";
import ProspectDetailDrawer from "@/components/prospects/ProspectDetailDrawer";
import AssociateClientModal from "@/components/communications/AssociateClientModal";
import CreateClientFromEmailModal from "@/components/communications/CreateClientFromEmailModal";
import { prospectPrefill } from "@/components/prospects/prospectFormat";
import { PageError, PageLoader, InlineLoader } from "@/components/dashboard/PageFeedback";
import EmptyState from "@/components/dashboard/EmptyState";
import { ActionButton } from "@/components/dashboard/ActionButton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function ProspectsInbox({
  items,
  total,
  loading,
  loadingMore,
  error,
  hasMore,
  onLoadMore,
  onChanged,
  emptyTitle,
  emptyDescription,
  query = "",
  tab = "pending",
  initialOpenId = null,
  onDetailClose,
}) {
  const { t } = useDashboardLang();
  const navigate = useNavigate();
  const [busyId, setBusyId] = useState(null);
  const [detailId, setDetailId] = useState(initialOpenId || null);

  useEffect(() => {
    if (initialOpenId) setDetailId(initialOpenId);
  }, [initialOpenId]);
  const [associateTarget, setAssociateTarget] = useState(null);
  const [createTarget, setCreateTarget] = useState(null);
  const [ignoreTarget, setIgnoreTarget] = useState(null);
  const actionLockRef = useRef(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((p) => {
      const hay = [
        p.displayName,
        p.company,
        p.email,
        p.phone,
        p.lastSubject,
        p.lastPreview,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [items, query]);

  const run = async (id, fn, successKey) => {
    if (actionLockRef.current || busyId) return;
    actionLockRef.current = true;
    setBusyId(id);
    try {
      await fn();
      if (successKey) toast.success(t(successKey));
      invalidateProspectsPendingCount();
      invalidateActionsPendingCount();
      await onChanged?.();
    } catch (err) {
      toastApiError(err, t, "prospects.actionError");
    } finally {
      actionLockRef.current = false;
      setBusyId(null);
    }
  };

  if (loading) {
    return <PageLoader label={t("prospects.loading")} compact testId="prospects-loading" />;
  }

  if (error) {
    return (
      <div className="p-4">
        <PageError message={error} testId="prospects-error" />
      </div>
    );
  }

  if (!items.length) {
    return (
      <EmptyState
        icon={UserPlus}
        title={emptyTitle || t("prospects.emptyTitle")}
        description={emptyDescription || t("prospects.empty")}
        testId="prospects-empty"
        compact
        inline
      />
    );
  }

  if (!filtered.length) {
    return (
      <EmptyState
        icon={UserPlus}
        title={t("prospects.searchEmptyTitle")}
        description={t("prospects.searchEmpty").replace("{query}", query.trim())}
        testId="prospects-search-empty"
        compact
        inline
      />
    );
  }

  return (
    <div className="p-4 space-y-3" data-testid="prospects-inbox">
      <p className="text-[11px] text-[#9CA3AF]">
        {t("prospects.count")
          .replace("{count}", String(filtered.length))
          .replace("{total}", String(total))}
      </p>

      {filtered.map((prospect) => (
        <ProspectCard
          key={prospect.id}
          prospect={prospect}
          busy={busyId === prospect.id}
          showRestore={tab === "ignored" || prospect.status === "ignored"}
          onTreat={() => setDetailId(prospect.id)}
          onRestore={() =>
            run(prospect.id, () => restoreProspect(prospect.id), "prospects.toastRestored")
          }
        />
      ))}

      {hasMore && !query.trim() ? (
        <div className="pt-2 flex justify-center">
          {loadingMore ? (
            <InlineLoader label={t("prospects.loadingMore")} className="py-2" />
          ) : (
            <ActionButton variant="secondary" onClick={onLoadMore} data-testid="prospects-load-more">
              {t("prospects.loadMore")}
            </ActionButton>
          )}
        </div>
      ) : null}

      <ProspectDetailDrawer
        open={Boolean(detailId)}
        prospectId={detailId}
        busy={busyId === detailId}
        onClose={() => {
          setDetailId(null);
          onDetailClose?.();
        }}
        onAssociate={(prospect) => {
          setAssociateTarget(prospect);
        }}
        onCreateClient={(prospect) => {
          setCreateTarget(prospect);
        }}
        onIgnore={(prospect) => setIgnoreTarget(prospect)}
        onRestore={(prospect) =>
          run(prospect.id, () => restoreProspect(prospect.id), "prospects.toastRestored").then(
            () => setDetailId(null)
          )
        }
      />

      <AssociateClientModal
        open={Boolean(associateTarget)}
        onClose={() => setAssociateTarget(null)}
        submitting={busyId === associateTarget?.id}
        title={t("prospects.associateTitle")}
        description={t("prospects.associateDesc")}
        onConfirm={async (client) => {
          if (!associateTarget || busyId) return;
          await run(
            associateTarget.id,
            () => associateProspect(associateTarget.id, client.id),
            "prospects.toastAssociated"
          );
          setAssociateTarget(null);
          setDetailId(null);
        }}
      />

      <CreateClientFromEmailModal
        open={Boolean(createTarget)}
        prefill={createTarget ? prospectPrefill(createTarget) : null}
        loading={false}
        submitting={busyId === createTarget?.id}
        title={t("prospects.createTitle")}
        description={t("prospects.createDesc")}
        confirmLabel={t("prospects.confirmCreate")}
        onClose={() => setCreateTarget(null)}
        onConfirm={async (payload) => {
          if (!createTarget || busyId) return;
          let nextClientId = null;
          await run(
            createTarget.id,
            async () => {
              const result = await createClientFromProspect(createTarget.id, payload);
              nextClientId = result?.client?.id || result?.duplicateClientId || null;
              if (result.duplicateClientId) {
                toast.message(t("prospects.toastDuplicateLinked"));
              }
            },
            "prospects.toastClientCreated"
          );
          setCreateTarget(null);
          setDetailId(null);
          if (nextClientId) {
            navigate(`/dashboard/clients/${encodeURIComponent(nextClientId)}`);
          }
        }}
      />

      <AlertDialog
        open={Boolean(ignoreTarget)}
        onOpenChange={(next) => !next && setIgnoreTarget(null)}
      >
        <AlertDialogContent data-testid="prospect-ignore-confirm">
          <AlertDialogHeader>
            <AlertDialogTitle>{t("prospects.ignoreTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("prospects.ignoreDesc")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={Boolean(busyId)}>{t("prospects.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              disabled={Boolean(busyId)}
              onClick={(e) => {
                e.preventDefault();
                if (!ignoreTarget || busyId) return;
                run(
                  ignoreTarget.id,
                  () => ignoreProspect(ignoreTarget.id),
                  "prospects.toastIgnored"
                ).then(() => {
                  setIgnoreTarget(null);
                  setDetailId(null);
                });
              }}
              data-testid="prospect-ignore-confirm-btn"
            >
              {t("prospects.ignoreConfirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
