import { ArrowLeft, Mail, MapPin, Phone, Pencil, Trash2, FileText, Receipt } from "lucide-react";
import { ActionButton } from "@/components/dashboard/ActionButton";
import StatusBadge from "@/components/dashboard/StatusBadge";
import {
  formatLastInteraction,
  getClientColor,
  getClientInitials,
  getDisplayCompany,
  getDisplayName,
} from "@/utils/clientDisplay";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  DELETE_MODAL_CONTENT_CLASS,
  DELETE_MODAL_OVERLAY_CLASS,
} from "@/components/dashboard/DeleteConfirmDialog";

export default function ClientDetailHeader({
  client,
  lang,
  t,
  onBack,
  onEdit,
  onDelete,
  onCreateQuote,
  onCreateInvoice,
}) {
  const initials = getClientInitials(client);
  const color = getClientColor(client.id);
  const company = getDisplayCompany(client);
  const contactName = getDisplayName(client);
  const location = [client.city, client.address].filter(Boolean).join(", ") || null;

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={onBack}
        data-testid="client-detail-back"
        className="inline-flex items-center gap-1.5 text-xs font-medium text-[#4B5563] hover:text-[#111827]"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        {t("clientDetail.back")}
      </button>

      <div className="bg-white border border-[#E5E7EB] rounded-xl p-5 md:p-6">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-5">
          <div className="flex items-start gap-4 min-w-0 flex-1">
            <div
              className="w-14 h-14 rounded-xl flex items-center justify-center text-lg font-semibold text-white shrink-0"
              style={{ backgroundColor: color }}
            >
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <h1 className="font-cabinet text-2xl font-bold text-[#111827] tracking-tight truncate">
                  {company}
                </h1>
                <StatusBadge kind="client" status={client.status} size="sm" />
              </div>
              <p className="text-sm text-[#4B5563]">
                {contactName}
                {client.activity ? ` · ${client.activity}` : ""}
              </p>
              <p className="text-[11px] text-[#9CA3AF] mt-1">
                {t("clientDetail.lastActivity")} · {formatLastInteraction(client.updatedAt, lang)}
              </p>
              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 text-xs text-[#4B5563]">
                {client.email && (
                  <span className="inline-flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 shrink-0" />
                    {client.email}
                  </span>
                )}
                {client.phone && (
                  <span className="inline-flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 shrink-0" />
                    {client.phone}
                  </span>
                )}
                {location && (
                  <span className="inline-flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 shrink-0" />
                    {location}
                  </span>
                )}
              </div>
              {client.notes ? (
                <p className="mt-3 text-sm text-[#4B5563] border-t border-[#F3F4F6] pt-3 line-clamp-2">
                  {client.notes}
                </p>
              ) : null}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <ActionButton variant="primary" onClick={onCreateQuote} className="gap-1.5" data-testid="client-create-quote">
              <FileText className="w-4 h-4" />
              {t("actions.createQuote")}
            </ActionButton>
            <ActionButton variant="secondary" onClick={onCreateInvoice} className="gap-1.5" data-testid="client-create-invoice">
              <Receipt className="w-4 h-4" />
              {t("actions.createInvoice")}
            </ActionButton>
            <ActionButton variant="secondary" onClick={onEdit} className="gap-1.5" data-testid="client-detail-edit">
              <Pencil className="w-3.5 h-3.5" />
              {t("clientDetail.edit")}
            </ActionButton>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <ActionButton variant="dangerText" data-testid="client-detail-delete" className="gap-1.5">
                  <Trash2 className="w-3.5 h-3.5" />
                  {t("clientDetail.delete")}
                </ActionButton>
              </AlertDialogTrigger>
              <AlertDialogContent
                overlayClassName={DELETE_MODAL_OVERLAY_CLASS}
                className={DELETE_MODAL_CONTENT_CLASS}
                data-testid="client-delete-dialog"
              >
                <AlertDialogHeader>
                  <AlertDialogTitle className="font-cabinet text-xl font-bold tracking-[-0.02em] text-[#111827]">
                    {t("clientDetail.deleteTitle")}
                  </AlertDialogTitle>
                  <AlertDialogDescription className="text-[#4B5563]">
                    {t("clientDetail.deleteDesc")}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter className="gap-2 sm:gap-0 pt-2">
                  <AlertDialogCancel className="rounded-xl border-[#E5E7EB] bg-white text-[#374151] hover:bg-[#F9FAFB]">
                    {t("clientForm.cancel")}
                  </AlertDialogCancel>
                  <AlertDialogAction onClick={onDelete} className="rounded-xl bg-[#991B1B] text-white hover:bg-[#7F1D1D]">
                    {t("clientDetail.confirmDelete")}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </div>
    </div>
  );
}
