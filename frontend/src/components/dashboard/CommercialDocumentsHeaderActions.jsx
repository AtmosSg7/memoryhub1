import { ChevronDown, Plus, Upload } from "lucide-react";
import { useDashboardLang } from "@/hooks/useDashboardLang";
import { ActionButton } from "@/components/dashboard/ActionButton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function CommercialDocumentsHeaderActions({
  hasClients,
  onCreateQuote,
  onCreateInvoice,
  onImportQuote,
  onImportInvoice,
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
        onClick={() => guardClient(onCreateQuote)}
        data-testid="commercial-documents-create-quote"
      >
        <Plus className="w-4 h-4" />
        {t("actions.createQuote")}
      </ActionButton>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <ActionButton variant="secondary" data-testid="commercial-documents-more-actions">
            {t("actions.moreActions")}
            <ChevronDown className="w-4 h-4" />
          </ActionButton>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuItem
            onClick={() => guardClient(onCreateInvoice)}
            data-testid="commercial-documents-create-invoice"
          >
            <Plus className="w-4 h-4 mr-2" />
            {t("actions.createInvoice")}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => guardClient(onImportQuote)} data-testid="commercial-documents-import-quote">
            <Upload className="w-4 h-4 mr-2" />
            {t("actions.importQuote")}
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => guardClient(onImportInvoice)}
            data-testid="commercial-documents-import-invoice"
          >
            <Upload className="w-4 h-4 mr-2" />
            {t("actions.importInvoice")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
