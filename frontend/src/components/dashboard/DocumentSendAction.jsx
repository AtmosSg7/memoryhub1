import { useState } from "react";
import { SendHorizonal } from "lucide-react";
import { useDashboardLang } from "@/hooks/useDashboardLang";
import { ActionButton } from "@/components/dashboard/ActionButton";
import DocumentSendModal from "@/components/dashboard/DocumentSendModal";
import { canSendDocument } from "@/utils/documentSendDisplay";

export default function DocumentSendAction({ entityType, entity, compact = false, onRecorded }) {
  const { t } = useDashboardLang();
  const [open, setOpen] = useState(false);

  if (!canSendDocument(entityType, entity)) return null;

  return (
    <>
      <ActionButton
        variant="quick"
        onClick={() => setOpen(true)}
        className={compact ? "gap-1.5" : "h-10 px-4 text-sm gap-1.5"}
        data-testid={`send-${entityType}-${entity.id}`}
      >
        <SendHorizonal className="w-3.5 h-3.5" />
        {t("actions.sendToClient")}
      </ActionButton>

      <DocumentSendModal
        entityType={entityType}
        entityId={entity.id}
        open={open}
        onOpenChange={setOpen}
        onRecorded={onRecorded}
      />
    </>
  );
}
