import { FolderOpen, Upload } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useDashboardLang } from "@/hooks/useDashboardLang";
import { ActionButton } from "@/components/dashboard/ActionButton";

export default function CommercialDocumentsHeaderActions({
  hasClients,
  onImportDocument,
  onNeedClient,
}) {
  const { t } = useDashboardLang();
  const navigate = useNavigate();

  const guardClient = (action) => {
    if (hasClients) action();
    else onNeedClient?.();
  };

  return (
    <div className="flex items-center gap-2" data-testid="commercial-documents-header-actions">
      <ActionButton
        variant="primary"
        onClick={() => guardClient(onImportDocument)}
        data-testid="commercial-documents-import"
      >
        <Upload className="w-4 h-4" />
        {t("documentActions.importDocument")}
      </ActionButton>
      <ActionButton
        variant="secondary"
        onClick={() => navigate("/dashboard/documents")}
        data-testid="commercial-documents-view"
      >
        <FolderOpen className="w-4 h-4" />
        {t("dashboardV2.quickActions.viewDocuments")}
      </ActionButton>
    </div>
  );
}
