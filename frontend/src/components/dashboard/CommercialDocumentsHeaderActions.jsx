import { ChevronDown, FilePlus, Plus, Upload } from "lucide-react";
import { useDashboardLang } from "@/hooks/useDashboardLang";
import { ActionButton } from "@/components/dashboard/ActionButton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function CommercialDocumentsHeaderActions({
  hasClients,
  onImportDocument,
  onCreateQuote,
  onCreateInvoice,
  onCreateBlank,
  onNeedClient,
}) {
  const { t } = useDashboardLang();

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

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <ActionButton variant="secondary" data-testid="commercial-documents-add-menu">
            {t("documentActions.add")}
            <ChevronDown className="w-4 h-4" />
          </ActionButton>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuItem
            onClick={() => guardClient(onCreateQuote)}
            data-testid="commercial-documents-create-quote"
          >
            <Plus className="w-4 h-4 mr-2" />
            {t("documentActions.addProposal")}
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => guardClient(onCreateInvoice)}
            data-testid="commercial-documents-create-invoice"
          >
            <Plus className="w-4 h-4 mr-2" />
            {t("documentActions.addTrackingInvoice")}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => guardClient(onImportDocument)}
            data-testid="commercial-documents-import-multiple"
          >
            <Upload className="w-4 h-4 mr-2" />
            {t("documentActions.importMultiple")}
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => guardClient(onCreateBlank)}
            data-testid="commercial-documents-create-blank"
          >
            <FilePlus className="w-4 h-4 mr-2" />
            {t("documentActions.createBlankAdvanced")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
