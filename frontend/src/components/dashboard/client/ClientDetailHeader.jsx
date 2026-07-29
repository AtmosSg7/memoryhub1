import { useState } from "react";
import { ArrowLeft, ChevronLeft, ChevronRight, Mail, MapPin, Phone, Pencil, Trash2, FileText, Receipt, Loader2, StickyNote, Star } from "lucide-react";
import { ActionButton } from "@/components/dashboard/ActionButton";
import StatusBadge from "@/components/dashboard/StatusBadge";
import {
  formatClientLocation,
  formatLastInteraction,
  getClientColor,
  getClientInitials,
  getClientTags,
  getDisplayCompany,
  getDisplayName,
  getPrimaryEmail,
  getPrimaryPhone,
  isClientFavorite,
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
  onPrevClient,
  onNextClient,
  prevClientLabel,
  nextClientLabel,
  onEdit,
  onDelete,
  onCreateQuote,
  onCreateInvoice,
  onCreateNote,
  onToggleFavorite,
  favoriteSaving = false,
}) {
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const initials = getClientInitials(client);
  const color = getClientColor(client.id);
  const company = getDisplayCompany(client);
  const contactName = getDisplayName(client);
  const email = getPrimaryEmail(client);
  const phone = getPrimaryPhone(client);
  const location = formatClientLocation(client) || null;
  const tags = getClientTags(client);
  const favorite = isClientFavorite(client);

  const handleDelete = async () => {
    if (deleting) return;
    setDeleting(true);
    try {
      await onDelete();
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          data-testid="client-detail-back"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-[#4B5563] hover:text-[#111827] transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          {t("clientDetail.back")}
        </button>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onPrevClient?.()}
            disabled={!onPrevClient}
            title={prevClientLabel}
            data-testid="client-detail-prev"
            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium text-[#4B5563] hover:bg-[#F3F4F6] disabled:opacity-40 disabled:pointer-events-none"
          >
            <ChevronLeft className="w-4 h-4" />
            <span className="hidden sm:inline max-w-[120px] truncate">{prevClientLabel || "—"}</span>
          </button>
          <button
            type="button"
            onClick={() => onNextClient?.()}
            disabled={!onNextClient}
            title={nextClientLabel}
            data-testid="client-detail-next"
            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium text-[#4B5563] hover:bg-[#F3F4F6] disabled:opacity-40 disabled:pointer-events-none"
          >
            <span className="hidden sm:inline max-w-[120px] truncate">{nextClientLabel || "—"}</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

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
                {onToggleFavorite ? (
                  <button
                    type="button"
                    onClick={onToggleFavorite}
                    disabled={favoriteSaving}
                    title={favorite ? t("clientDetail.unfavorite") : t("clientDetail.favorite")}
                    aria-pressed={favorite}
                    data-testid="client-favorite-toggle"
                    className={[
                      "inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg text-xs font-semibold border transition-colors",
                      favorite
                        ? "bg-[#FFFBEB] text-[#B45309] border-[#FDE68A] hover:bg-[#FEF3C7]"
                        : "bg-white text-[#6B7280] border-[#E5E7EB] hover:bg-[#F9FAFB] hover:text-[#111827]",
                    ].join(" ")}
                  >
                    <Star className={`w-3.5 h-3.5 ${favorite ? "fill-current" : ""}`} />
                    {favorite ? t("clientDetail.favorite") : t("clientDetail.addFavorite")}
                  </button>
                ) : favorite ? (
                  <span
                    className="inline-flex items-center text-[#B45309]"
                    title={t("clientDetail.favorite")}
                    data-testid="client-favorite-badge"
                  >
                    <Star className="w-4 h-4 fill-current" />
                  </span>
                ) : null}
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
                {email ? (
                  <span className="inline-flex items-center gap-1.5" data-testid="client-header-email">
                    <Mail className="w-3.5 h-3.5 shrink-0" />
                    {email}
                  </span>
                ) : null}
                {phone ? (
                  <span className="inline-flex items-center gap-1.5" data-testid="client-header-phone">
                    <Phone className="w-3.5 h-3.5 shrink-0" />
                    {phone}
                  </span>
                ) : null}
                {location ? (
                  <span className="inline-flex items-center gap-1.5" data-testid="client-header-location">
                    <MapPin className="w-3.5 h-3.5 shrink-0" />
                    {location}
                  </span>
                ) : null}
              </div>
              {tags.length ? (
                <div className="flex flex-wrap gap-1.5 mt-3" data-testid="client-header-tags">
                  {tags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wide bg-[#F3F4F6] text-[#4B5563] border border-[#E5E7EB]"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              ) : null}
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
            <ActionButton variant="secondary" onClick={onCreateNote} className="gap-1.5" data-testid="client-create-note">
              <StickyNote className="w-4 h-4" />
              {t("actions.createNote")}
            </ActionButton>
            <ActionButton variant="secondary" onClick={onEdit} className="gap-1.5" data-testid="client-detail-edit">
              <Pencil className="w-3.5 h-3.5" />
              {t("clientDetail.edit")}
            </ActionButton>
            <AlertDialog open={deleteOpen} onOpenChange={(open) => !deleting && setDeleteOpen(open)}>
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
                  <AlertDialogCancel
                    disabled={deleting}
                    className="rounded-xl border-[#E5E7EB] bg-white text-[#374151] hover:bg-[#F9FAFB]"
                  >
                    {t("clientForm.cancel")}
                  </AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDelete}
                    disabled={deleting}
                    data-testid="client-delete-dialog-confirm"
                    className="rounded-xl bg-[#991B1B] text-white hover:bg-[#7F1D1D]"
                  >
                    {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : t("clientDetail.confirmDelete")}
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
