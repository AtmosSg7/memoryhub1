import { useState } from "react";
import {
  Download,
  Eye,
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DANGER_MENU_ITEM_CLASS } from "@/components/dashboard/detailModalLayout";

export default function CommercialDocumentRowActions({
  kind,
  document,
  onView,
  onEdit,
  onImportFinalInvoice,
  onDelete,
  onRefresh,
}) {
  const { t, lang } = useDashboardLang();
  const { notifyQuotesChanged } = useAddQuote();
  const { notifyInvoicesChanged } = useAddInvoice();
  const { openAddNote } = useAddNote();
  const [submitting, setSubmitting] = useState(false);
  const [sendOpen, setSendOpen] = useState(false);
  const [followUpOpen, setFollowUpOpen] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);

  if (!document?.id) return null;

  const isQuote = kind === "quote";
  const canSend = canSendDocument(kind, document);
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
    onRefresh?.();
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
      await markInvoicePaid(document.id);
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
      await markInvoiceInProgress(document.id);
      refresh();
      toast.success(t("toast.invoiceReopened"), { description: document.number });
    } catch (err) {
      toastApiError(err, t, "toast.invoicePaymentError");
    } finally {
      setSubmitting(false);
    }
  };

  const handleMarkWon = async () => {
    setSubmitting(true);
    try {
      await updateQuote(document.id, { status: "accepted" });
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
      await updateQuote(document.id, { status: "rejected" });
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
    menuItems.push({
      key: "edit",
      label: t("documentActions.editInfo"),
      icon: Pencil,
      onClick: () => onEdit(document),
    });
  }

  if (onEdit) {
    menuItems.push({
      key: "link-client",
      label: t("documentActions.linkClient"),
      icon: Link2,
      onClick: () => onEdit(document),
    });
  }

  if (hasClient) {
    menuItems.push({
      key: "add-note",
      label: t("documentActions.addNote"),
      icon: StickyNote,
      onClick: handleAddNote,
    });
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
    menuItems.push({
      key: "mark-won",
      label: t("documentActions.markWon"),
      icon: ThumbsUp,
      onClick: handleMarkWon,
    });
  }

  if (canMarkLost) {
    menuItems.push({
      key: "mark-lost",
      label: t("documentActions.markLost"),
      icon: ThumbsDown,
      onClick: handleMarkLost,
    });
  }

  if (canCollect) {
    menuItems.push({
      key: "mark-settled",
      label: t("documentActions.markSettled"),
      icon: Wallet,
      onClick: handleMarkPaid,
    });
    menuItems.push({
      key: "partial",
      label: t("actions.partialPayment"),
      icon: Wallet,
      onClick: () => setPaymentOpen(true),
    });
  }

  if (canReopen) {
    menuItems.push({
      key: "reopen",
      label: t("actions.reopen"),
      icon: RotateCcw,
      onClick: handleReopen,
    });
  }

  if (canFollowUp) {
    menuItems.push({
      key: "follow-up",
      label: t("actions.followUp"),
      icon: Send,
      onClick: () => setFollowUpOpen(true),
    });
  }

  if (canSend) {
    menuItems.push({
      key: "send",
      label: t("documentActions.sendAdvanced"),
      icon: Send,
      onClick: () => setSendOpen(true),
    });
  }

  menuItems.push({
    key: "pdf",
    label: t("actions.downloadPdf"),
    icon: Download,
    onClick: handleDownload,
  });

  return (
    <>
      <div className="flex items-center justify-end gap-1.5" onClick={(event) => event.stopPropagation()}>
        <ActionButton
          variant="secondary"
          onClick={() => onView?.(document)}
          disabled={submitting}
          className="h-9 px-3 text-xs gap-1.5"
          data-testid={`row-primary-view-${kind}-${document.id}`}
        >
          <Eye className="w-3.5 h-3.5" />
          {t("documentActions.view")}
        </ActionButton>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <ActionButton
              variant="ghostIcon"
              aria-label={t("documentActions.add")}
              data-testid={`row-more-${kind}-${document.id}`}
            >
              <MoreHorizontal className="w-4 h-4" />
            </ActionButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            {menuItems.map((item) => {
              const Icon = item.icon;
              return (
                <DropdownMenuItem key={item.key} onClick={item.onClick} disabled={submitting}>
                  <Icon className="w-4 h-4 mr-2" />
                  {item.label}
                </DropdownMenuItem>
              );
            })}
            {onDelete ? (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={onDelete}
                  className={DANGER_MENU_ITEM_CLASS}
                  data-testid={`row-delete-${kind}-${document.id}`}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  {t("actions.delete")}
                </DropdownMenuItem>
              </>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <DocumentSendModal
        entityType={kind}
        entityId={document.id}
        open={sendOpen}
        onOpenChange={setSendOpen}
        onRecorded={refresh}
      />
      <FollowUpModal
        entityType={kind}
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
          onUpdated={refresh}
        />
      ) : null}
    </>
  );
}
