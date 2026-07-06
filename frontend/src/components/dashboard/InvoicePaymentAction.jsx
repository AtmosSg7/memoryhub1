import { useState } from "react";
import { CheckCircle2, Loader2, RotateCcw, Wallet } from "lucide-react";
import { toast } from "sonner";
import { useDashboardLang } from "@/hooks/useDashboardLang";
import { useAddInvoice } from "@/context/AddInvoiceContext";
import { markInvoiceInProgress } from "@/lib/invoicesApi";
import { getInvoiceAmountDue, getInvoiceAmountPaid, normalizeInvoiceStatus } from "@/utils/invoiceDisplay";
import { ActionButton } from "@/components/dashboard/ActionButton";
import InvoicePaymentModal from "@/components/dashboard/InvoicePaymentModal";

export default function InvoicePaymentAction({ invoice, compact = false, onUpdated }) {
  const { t } = useDashboardLang();
  const { notifyInvoicesChanged } = useAddInvoice();
  const [submitting, setSubmitting] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  if (!invoice?.id) return null;

  const status = normalizeInvoiceStatus(invoice.status);
  if (status === "cancelled") return null;

  const amountDue = getInvoiceAmountDue(invoice);
  const amountPaid = getInvoiceAmountPaid(invoice);
  const canCollect = amountDue > 0 && (status === "in_progress" || status === "overdue");
  const canReopen = amountPaid > 0;

  const handleReopen = async () => {
    setSubmitting(true);
    try {
      const updated = await markInvoiceInProgress(invoice.id);
      notifyInvoicesChanged();
      onUpdated?.(updated);
      toast.success(t("toast.invoiceReopened"), { description: updated.number });
    } catch (err) {
      toast.error(err.message || t("toast.invoicePaymentError"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      {canCollect ? (
        <ActionButton
          variant="success"
          onClick={() => setModalOpen(true)}
          disabled={submitting}
          className={compact ? "gap-1.5" : "h-10 px-4 text-sm gap-1.5"}
          data-testid={`invoice-collect-${invoice.id}`}
        >
          <Wallet className="w-3.5 h-3.5" />
          {t("actions.collect")}
        </ActionButton>
      ) : null}

      {canReopen ? (
        <ActionButton
          variant="quick"
          onClick={handleReopen}
          disabled={submitting}
          className={compact ? undefined : "h-10 px-4 text-sm"}
          data-testid={`invoice-reopen-${invoice.id}`}
        >
          {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
          {t("actions.reopen")}
        </ActionButton>
      ) : null}

      {!canCollect && !canReopen && status === "paid" ? (
        <ActionButton variant="quick" disabled className={compact ? undefined : "h-10 px-4 text-sm gap-1.5"}>
          <CheckCircle2 className="w-3.5 h-3.5" />
          {t("invoicePayment.paid")}
        </ActionButton>
      ) : null}

      <InvoicePaymentModal
        invoice={invoice}
        open={modalOpen}
        onOpenChange={setModalOpen}
        onUpdated={onUpdated}
      />
    </>
  );
}
