import { useState } from "react";
import { Send } from "lucide-react";
import { useDashboardLang } from "@/hooks/useDashboardLang";
import { ActionButton } from "@/components/dashboard/ActionButton";
import FollowUpModal from "@/components/dashboard/FollowUpModal";
import { canFollowUpInvoice, canFollowUpQuote } from "@/utils/followUpDisplay";

export default function FollowUpAction({ entityType, entity, compact = false, onRecorded }) {
  const { t } = useDashboardLang();
  const [open, setOpen] = useState(false);

  if (!entity?.id) return null;

  const eligible =
    entityType === "quote" ? canFollowUpQuote(entity) : entityType === "invoice" ? canFollowUpInvoice(entity) : false;

  if (!eligible) return null;

  return (
    <>
      <ActionButton
        variant="quick"
        onClick={() => setOpen(true)}
        className={compact ? "gap-1.5" : "h-10 px-4 text-sm gap-1.5"}
        data-testid={`follow-up-${entityType}-${entity.id}`}
      >
        <Send className="w-3.5 h-3.5" />
        {t("actions.followUp")}
      </ActionButton>

      <FollowUpModal
        entityType={entityType}
        entityId={entity.id}
        open={open}
        onOpenChange={setOpen}
        onRecorded={onRecorded}
      />
    </>
  );
}
