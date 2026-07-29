import { useState } from "react";
import {
  Download,
  ExternalLink,
  Loader2,
  MoreHorizontal,
  Pencil,
  Receipt,
  RotateCcw,
  Send,
  SendHorizonal,
  Trash2,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { toastApiError } from "@/utils/apiErrors";
import { useDashboardLang } from "@/hooks/useDashboardLang";
import { useAddQuote } from "@/context/AddQuoteContext";
import { useAddInvoice } from "@/context/AddInvoiceContext";
import { convertQuoteToInvoice } from "@/lib/quotesApi";
import { getInvoice, markInvoiceInProgress, markInvoicePaid } from "@/lib/invoicesApi";
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
import { DetailModalFooter } from "@/components/dashboard/detailModalLayout";
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
}) {
  const { t, lang } = useDashboardLang();
  const { notifyQuotesChanged } = useAddQuote();
  const { notifyInvoicesChanged, queueOpenInvoice } = useAddInvoice();
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
  const canCreateInvoice = isQuote && document.status === "accepted" && !document.invoiceId;
  const hasLinkedInvoice = isQuote && Boolean(document.invoiceId);
  const prioritizeSend = isQuote && (document.status === "draft" || document.status === "sent");

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

  const handleConvert = async () => {
    setSubmitting(true);
    try {
      const invoice = await convertQuoteToInvoice(document.id);
      notifyQuotesChanged();
      notifyInvoicesChanged();
      toast.success(t("toast.invoiceCreatedFromQuote"), { description: invoice.number });
      onClose?.();
      queueOpenInvoice(invoice);
    } catch (err) {
      toastApiError(err, t, "toast.quoteConvertError");
    } finally {
      setSubmitting(false);
    }
  };

  const handleViewInvoice = async () => {
    if (!document.invoiceId) return;
    setSubmitting(true);
    try {
      const invoice = await getInvoice(document.invoiceId);
      onClose?.();
      queueOpenInvoice(invoice);
    } catch (err) {
      toastApiError(err, t, "toast.linkedInvoiceMissing");
    } finally {
      setSubmitting(false);
    }
  };

  let primaryAction = null;
  if (prioritizeSend && canSend) {
    primaryAction = (
      <ActionButton variant="primary" onClick={() => setSendOpen(true)} disabled={submitting} className="gap-1.5">
        <SendHorizonal className="w-3.5 h-3.5" />
        {t("actions.sendToClient")}
      </ActionButton>
    );
  } else if (canCreateInvoice) {
    primaryAction = (
      <ActionButton variant="primary" onClick={handleConvert} disabled={submitting} className="gap-1.5">
        {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Receipt className="w-3.5 h-3.5" />}
        {t("actions.createInvoiceFromQuote")}
      </ActionButton>
    );
  } else if (canCollect) {
    primaryAction = (
      <ActionButton variant="success" onClick={handleMarkPaid} disabled={submitting} className="gap-1.5">
        {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wallet className="w-3.5 h-3.5" />}
        {t("actions.markPaid")}
      </ActionButton>
    );
  } else if (onEdit) {
    primaryAction = (
      <ActionButton variant="primary" onClick={onEdit} className="gap-1.5">
        <Pencil className="w-3.5 h-3.5" />
        {t("actions.edit")}
      </ActionButton>
    );
  }

  const menuItems = [];
  if (!prioritizeSend && canSend) {
    menuItems.push({ key: "send", label: t("actions.sendToClient"), icon: SendHorizonal, onClick: () => setSendOpen(true) });
  }
  menuItems.push({ key: "pdf", label: t("actions.downloadPdf"), icon: Download, onClick: handleDownload });
  if (canFollowUp) {
    menuItems.push({ key: "follow-up", label: t("actions.followUp"), icon: Send, onClick: () => setFollowUpOpen(true) });
  }
  if (canCollect) {
    menuItems.push({ key: "partial", label: t("actions.partialPayment"), icon: Wallet, onClick: () => setPaymentOpen(true) });
  }
  if (canReopen) {
    menuItems.push({ key: "reopen", label: t("actions.reopen"), icon: RotateCcw, onClick: handleReopen });
  }
  if (hasLinkedInvoice) {
    menuItems.push({ key: "view-invoice", label: t("actions.viewInvoice"), icon: ExternalLink, onClick: handleViewInvoice });
  }
  if (canCreateInvoice && primaryAction) {
    menuItems.push({ key: "convert", label: t("actions.createInvoiceFromQuote"), icon: Receipt, onClick: handleConvert });
  }
  if (onEdit && primaryAction) {
    menuItems.push({ key: "edit", label: t("actions.edit"), icon: Pencil, onClick: onEdit });
  }

  return (
    <>
      <DetailModalFooter
        secondary={
          <ActionButton variant="secondary" onClick={onClose}>
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
                  aria-label={t("actions.moreActions")}
                  data-testid="commercial-detail-more-actions"
                >
                  <MoreHorizontal className="w-4 h-4" />
                  {t("actions.moreActions")}
                </ActionButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52" data-testid="commercial-detail-more-menu">
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
                    <DropdownMenuItem onSelect={onDelete} className="text-red-600 focus:text-red-600">
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
