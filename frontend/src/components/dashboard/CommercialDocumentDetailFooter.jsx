import { useState } from "react";
import {
  Download,
  FileUp,
  Link2,
  Loader2,
  MoreHorizontal,
  Pencil,
  RotateCcw,
  Send,
  StickyNote,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { toastApiError } from "@/utils/apiErrors";
import { useDashboardLang } from "@/hooks/useDashboardLang";
import { useAddQuote } from "@/context/AddQuoteContext";
import { useAddInvoice } from "@/context/AddInvoiceContext";
import { useAddNote } from "@/context/AddNoteContext";
import { updateQuote } from "@/lib/quotesApi";
import { markInvoiceInProgress, markInvoicePaid } from "@/lib/invoicesApi";
import { downloadInvoicePdf, downloadQuotePdf } from "@/lib/commercialPdfApi";
import {
  getInvoiceAmountDue,
  getInvoiceAmountPaid,
  normalizeInvoiceStatus,
} from "@/utils/invoiceDisplay";
import { canSendDocument } from "@/utils/documentSendDisplay";
import { canFollowUpInvoice, canFollowUpQuote } from "@/utils/followUpDisplay";
import { ActionButton } from "@/components/dashboard/ActionButton";
import DocumentSendModal from "@/components/dashboard/DocumentSendModal";
import FollowUpModal from "@/components/dashboard/FollowUpModal";
import InvoicePaymentModal from "@/components/dashboard/InvoicePaymentModal";
import { DANGER_MENU_ITEM_CLASS, DetailModalFooter } from "@/components/dashboard/detailModalLayout";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function CommercialDocumentDetailFooter({
  type,
  document,
  onClose,
  onEdit,
  onDelete,
  onDocumentUpdated,
  onImportFinalInvoice,
}) {
  const { t, lang } = useDashboardLang();
  const { notifyQuotesChanged } = useAddQuote();
  const { notifyInvoicesChanged } = useAddInvoice();
  const { openAddNote } = useAddNote();
  const [submitting, setSubmitting] = useState(false);
  const [sendOpen, setSendOpen] = useState(false);
  const [followUpOpen, setFollowUpOpen] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);

  const isQuote = type === "quote";
  const canSend = canSendDocument(type, document);
  const canFollowUp = isQuote ? canFollowUpQuote(document) : canFollowUpInvoice(document);
  const status = isQuote ? document.status : normalizeInvoiceStatus(document.status);
  const amountDue = isQuote ? 0 : getInvoiceAmountDue(document);
  const amountPaid = isQuote ? 0 : getInvoiceAmountPaid(document);
  const canCollect = !isQuote && amountDue > 0 && (status === "in_progress" || status === "overdue");
  const canReopen = !isQuote && amountPaid > 0;
  const canImportFinal = isQuote && document.status === "accepted" && !document.invoiceId;
  const canMarkWon = isQuote && document.status === "sent";
  const canMarkLost = isQuote && ["draft", "sent"].includes(document.status);
  const hasClient = Boolean(document.clientId);

  const refresh = () => {
    if (isQuote) notifyQuotesChanged();
    else notifyInvoicesChanged();
  };

  const handleDownload = async () => {
    setSubmitting(true);
    try {
      if (isQuote) {
        await downloadQuotePdf(document.id, { lang, number: document.number });
      } else {
        await downloadInvoicePdf(document.id, { lang, number: document.number });
      }
    } catch (err) {
      toastApiError(err, t, "toast.pdfDownloadError");
    } finally {
      setSubmitting(false);
    }
  };

  const handleMarkPaid = async () => {
    setSubmitting(true);
    try {
      const updated = await markInvoicePaid(document.id);
      onDocumentUpdated?.(updated);
      refresh();
      toast.success(t("toast.invoicePaymentRecorded"), { description: document.number });
    } catch (err) {
      toastApiError(err, t, "toast.invoicePaymentError");
    } finally {
      setSubmitting(false);
    }
  };

  const handleReopen = async () => {
    setSubmitting(true);
    try {
      const updated = await markInvoiceInProgress(document.id);
      onDocumentUpdated?.(updated);
      refresh();
      toast.success(t("toast.invoiceReopened"), { description: updated.number });
    } catch (err) {
      toastApiError(err, t, "toast.invoicePaymentError");
    } finally {
      setSubmitting(false);
    }
  };

  const handleMarkWon = async () => {
    setSubmitting(true);
    try {
      const updated = await updateQuote(document.id, { status: "accepted" });
      onDocumentUpdated?.(updated);
      refresh();
      toast.success(t("documentActions.markWonSuccess"), { description: document.number });
    } catch (err) {
      toastApiError(err, t, "toast.quoteError");
    } finally {
      setSubmitting(false);
    }
  };

  const handleMarkLost = async () => {
    setSubmitting(true);
    try {
      const updated = await updateQuote(document.id, { status: "rejected" });
      onDocumentUpdated?.(updated);
      refresh();
      toast.success(t("documentActions.markLostSuccess"), { description: document.number });
    } catch (err) {
      toastApiError(err, t, "toast.quoteError");
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddNote = () => {
    if (!hasClient) return;
    openAddNote({ id: document.clientId, name: document.clientName });
  };

  const menuItems = [];

  if (onEdit) {
    menuItems.push({ key: "edit", label: t("documentActions.editInfo"), icon: Pencil, onClick: onEdit });
    menuItems.push({ key: "link-client", label: t("documentActions.linkClient"), icon: Link2, onClick: onEdit });
  }

  if (hasClient) {
    menuItems.push({ key: "add-note", label: t("documentActions.addNote"), icon: StickyNote, onClick: handleAddNote });
  }

  if (canImportFinal && onImportFinalInvoice) {
    menuItems.push({
      key: "import-final",
      label: t("documentActions.importFinalInvoice"),
      icon: FileUp,
      onClick: () => onImportFinalInvoice(document),
    });
  }

  if (canMarkWon) {
    menuItems.push({ key: "mark-won", label: t("documentActions.markWon"), icon: ThumbsUp, onClick: handleMarkWon });
  }

  if (canMarkLost) {
    menuItems.push({ key: "mark-lost", label: t("documentActions.markLost"), icon: ThumbsDown, onClick: handleMarkLost });
  }

  if (canCollect) {
    menuItems.push({ key: "mark-settled", label: t("documentActions.markSettled"), icon: Wallet, onClick: handleMarkPaid });
    menuItems.push({ key: "partial", label: t("actions.partialPayment"), icon: Wallet, onClick: () => setPaymentOpen(true) });
  }

  if (canReopen) {
    menuItems.push({ key: "reopen", label: t("actions.reopen"), icon: RotateCcw, onClick: handleReopen });
  }

  if (canFollowUp) {
    menuItems.push({ key: "follow-up", label: t("actions.followUp"), icon: Send, onClick: () => setFollowUpOpen(true) });
  }

  if (canSend) {
    menuItems.push({ key: "send", label: t("documentActions.sendAdvanced"), icon: Send, onClick: () => setSendOpen(true) });
  }

  menuItems.push({ key: "pdf", label: t("actions.downloadPdf"), icon: Download, onClick: handleDownload });

  const primaryAction = onEdit ? (
    <ActionButton
      variant="primary"
      onClick={onEdit}
      className="gap-1.5"
      data-testid="commercial-detail-edit"
    >
      <Pencil className="w-3.5 h-3.5" />
      {t("documentActions.editInfo")}
    </ActionButton>
  ) : null;

  return (
    <>
      <DetailModalFooter
        secondary={
          <ActionButton variant="secondary" onClick={onClose} data-testid="commercial-detail-close">
            {t("actions.close")}
          </ActionButton>
        }
        primary={
          <div className="flex items-center gap-2">
            {primaryAction}
            <DropdownMenu modal={false}>
              <DropdownMenuTrigger asChild>
                <ActionButton
                  variant="secondary"
                  aria-label={t("documentActions.more")}
                  data-testid="commercial-detail-more-actions"
                >
                  <MoreHorizontal className="w-4 h-4" />
                  {t("documentActions.more")}
                </ActionButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56" data-testid="commercial-detail-more-menu">
                {menuItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <DropdownMenuItem key={item.key} onSelect={item.onClick} disabled={submitting}>
                      <Icon className="w-4 h-4 mr-2" />
                      {item.label}
                    </DropdownMenuItem>
                  );
                })}
                {onDelete ? (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onSelect={onDelete} className={DANGER_MENU_ITEM_CLASS}>
                      <Trash2 className="w-4 h-4 mr-2" />
                      {t("actions.delete")}
                    </DropdownMenuItem>
                  </>
                ) : null}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        }
      />

      <DocumentSendModal
        entityType={type}
        entityId={document.id}
        open={sendOpen}
        onOpenChange={setSendOpen}
        onRecorded={refresh}
      />
      <FollowUpModal
        entityType={type}
        entityId={document.id}
        open={followUpOpen}
        onOpenChange={setFollowUpOpen}
        onRecorded={refresh}
      />
      {!isQuote ? (
        <InvoicePaymentModal
          invoice={document}
          open={paymentOpen}
          onOpenChange={setPaymentOpen}
          onUpdated={(updated) => {
            onDocumentUpdated?.(updated);
            refresh();
          }}
        />
      ) : null}
    </>
  );
}
