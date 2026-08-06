import { useState } from "react";
import {
  ArrowLeft,
  Bell,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  FileText,
  Loader2,
  Mail,
  MapPin,
  MessagesSquare,
  Pencil,
  Phone,
  Plus,
  Receipt,
  Star,
  StickyNote,
  Trash2,
  Upload,
} from "lucide-react";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  onImportDocument,
  onCreateQuote,
  onCreateInvoice,
  onCreateNote,
  onCreateReminder,
  onOpenCommunications,
  onToggleFavorite,
  favoriteSaving = false,
  lastExchangeAt = null,
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
          className="inline-flex items-center gap-1.5 text-xs font-medium text-dash-text-muted hover:text-dash-text transition-colors"
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
            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium text-dash-text-muted hover:bg-dash-surface-muted disabled:opacity-40 disabled:pointer-events-none"
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
            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium text-dash-text-muted hover:bg-dash-surface-muted disabled:opacity-40 disabled:pointer-events-none"
          >
            <span className="hidden sm:inline max-w-[120px] truncate">{nextClientLabel || "—"}</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="bg-dash-surface border border-dash-border rounded-xl p-5 md:p-6">
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
                <h1 className="font-cabinet text-2xl font-bold text-dash-text tracking-tight truncate">
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
                        : "bg-dash-surface text-dash-text-muted border-dash-border hover:bg-dash-bg hover:text-dash-text",
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
              <p className="text-sm text-dash-text-muted">
                {contactName}
                {client.activity ? ` · ${client.activity}` : ""}
              </p>
              <p className="text-[11px] text-dash-text-subtle mt-1">
                {t("clientDetail.lastActivity")} ·{" "}
                {formatLastInteraction(lastExchangeAt || client.updatedAt, lang)}
              </p>
              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 text-xs text-dash-text-muted">
                {email ? (
                  <a
                    href={`mailto:${email}`}
                    className="inline-flex items-center gap-1.5 hover:text-dash-text transition-colors"
                    data-testid="client-header-email"
                  >
                    <Mail className="w-3.5 h-3.5 shrink-0" />
                    {email}
                  </a>
                ) : null}
                {phone ? (
                  <a
                    href={`tel:${phone}`}
                    className="inline-flex items-center gap-1.5 hover:text-dash-text transition-colors"
                    data-testid="client-header-phone"
                  >
                    <Phone className="w-3.5 h-3.5 shrink-0" />
                    {phone}
                  </a>
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
                      className="inline-flex px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wide bg-dash-surface-muted text-dash-text-muted border border-dash-border"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              ) : null}
              {client.notes ? (
                <p className="mt-3 text-sm text-dash-text-muted border-t border-dash-border-soft pt-3 line-clamp-2">
                  {client.notes}
                </p>
              ) : null}
            </div>
          </div>

          <div className="flex flex-col gap-2 shrink-0 w-full lg:w-auto">
            <div
              className="flex gap-2 overflow-x-auto scrollbar-none -mx-1 px-1 pb-0.5 lg:flex-wrap lg:overflow-visible"
              data-testid="client-quick-actions"
            >
              {phone ? (
                <ActionButton
                  variant="primary"
                  className="gap-1.5 min-h-11 shrink-0 flex-1 sm:flex-none"
                  onClick={() => {
                    window.location.href = `tel:${phone}`;
                  }}
                  data-testid="client-quick-call"
                >
                  <Phone className="w-4 h-4" />
                  {t("clientBrief.quick.call")}
                </ActionButton>
              ) : null}
              {email ? (
                <ActionButton
                  variant="secondary"
                  className="gap-1.5 min-h-11 shrink-0 flex-1 sm:flex-none"
                  onClick={() => {
                    window.location.href = `mailto:${email}`;
                  }}
                  data-testid="client-quick-email"
                >
                  <Mail className="w-4 h-4" />
                  {t("clientBrief.quick.email")}
                </ActionButton>
              ) : null}
              {onCreateNote ? (
                <ActionButton
                  variant="secondary"
                  onClick={onCreateNote}
                  className="gap-1.5 min-h-11 shrink-0"
                  data-testid="client-create-note"
                >
                  <StickyNote className="w-4 h-4" />
                  {t("actions.createNote")}
                </ActionButton>
              ) : null}
              {onCreateQuote ? (
                <ActionButton
                  variant="secondary"
                  onClick={onCreateQuote}
                  className="gap-1.5 min-h-11 shrink-0 hidden sm:inline-flex"
                  data-testid="client-create-quote"
                >
                  <FileText className="w-4 h-4" />
                  {t("clientBrief.quick.quote")}
                </ActionButton>
              ) : null}
              {onCreateReminder ? (
                <ActionButton
                  variant="secondary"
                  onClick={onCreateReminder}
                  className="gap-1.5 min-h-11 shrink-0 hidden sm:inline-flex"
                  data-testid="client-create-reminder"
                >
                  <Bell className="w-4 h-4" />
                  {t("clientBrief.quick.reminder")}
                </ActionButton>
              ) : null}
              {onOpenCommunications ? (
                <ActionButton
                  variant="secondary"
                  onClick={onOpenCommunications}
                  className="gap-1.5 min-h-11 shrink-0 hidden sm:inline-flex"
                  data-testid="client-open-communications"
                >
                  <MessagesSquare className="w-4 h-4" />
                  {t("clientBrief.quick.communications")}
                </ActionButton>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-2">
            <ActionButton
              variant="secondary"
              onClick={onImportDocument}
              className="gap-1.5 min-h-11 hidden sm:inline-flex"
              data-testid="client-import-document"
            >
              <Upload className="w-4 h-4" />
              <span>{t("documentActions.importDocument")}</span>
            </ActionButton>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <ActionButton variant="secondary" className="gap-1.5 min-h-11" data-testid="client-add-menu">
                  <Plus className="w-4 h-4" />
                  {t("documentActions.add")}
                  <ChevronDown className="w-3.5 h-3.5" />
                </ActionButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                {onCreateQuote ? (
                  <DropdownMenuItem onClick={onCreateQuote} data-testid="client-create-quote-menu">
                    <FileText className="w-4 h-4 mr-2" />
                    {t("documentActions.addProposal")}
                  </DropdownMenuItem>
                ) : null}
                <DropdownMenuItem onClick={onCreateInvoice} data-testid="client-create-invoice">
                  <Receipt className="w-4 h-4 mr-2" />
                  {t("documentActions.addTrackingInvoice")}
                </DropdownMenuItem>
                {onCreateReminder ? (
                  <DropdownMenuItem onClick={onCreateReminder} data-testid="client-create-reminder-menu">
                    <Bell className="w-4 h-4 mr-2" />
                    {t("clientBrief.quick.reminder")}
                  </DropdownMenuItem>
                ) : null}
                {onOpenCommunications ? (
                  <DropdownMenuItem onClick={onOpenCommunications} data-testid="client-open-communications-menu">
                    <MessagesSquare className="w-4 h-4 mr-2" />
                    {t("clientBrief.quick.communications")}
                  </DropdownMenuItem>
                ) : null}
                <DropdownMenuItem onClick={onImportDocument} className="sm:hidden" data-testid="client-import-document-menu">
                  <Upload className="w-4 h-4 mr-2" />
                  {t("documentActions.importDocument")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <ActionButton variant="secondary" onClick={onEdit} className="gap-1.5 min-h-11" data-testid="client-detail-edit">
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
                  <AlertDialogTitle className="font-cabinet text-xl font-bold tracking-[-0.02em] text-dash-text">
                    {t("clientDetail.deleteTitle")}
                  </AlertDialogTitle>
                  <AlertDialogDescription className="text-dash-text-muted">
                    {t("clientDetail.deleteDesc")}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter className="gap-2 sm:gap-0 pt-2">
                  <AlertDialogCancel
                    disabled={deleting}
                    className="rounded-xl border-dash-border bg-dash-surface text-dash-text-muted hover:bg-dash-bg"
                  >
                    {t("clientForm.cancel")}
                  </AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDelete}
                    disabled={deleting}
                    data-testid="client-delete-dialog-confirm"
                    className="rounded-xl bg-[color:var(--dash-danger-text)] text-white hover:opacity-90"
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
    </div>
  );
}
