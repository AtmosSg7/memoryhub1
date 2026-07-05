import { useState } from "react";
import { CheckCircle2, Loader2, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { useDashboardLang } from "@/hooks/useDashboardLang";
import { useAddInvoice } from "@/context/AddInvoiceContext";
import { markInvoiceInProgress, markInvoicePaid } from "@/lib/invoicesApi";
import { normalizeInvoiceStatus } from "@/utils/invoiceDisplay";
import { Button } from "@/components/ui/button";

export default function InvoicePaymentAction({ invoice, compact = false, onUpdated }) {
  const { t } = useDashboardLang();
  const { notifyInvoicesChanged } = useAddInvoice();
  const [submitting, setSubmitting] = useState(false);

  if (!invoice?.id) return null;

  const status = normalizeInvoiceStatus(invoice.status);
  if (status === "cancelled") return null;

  const handleMarkPaid = async () => {
    setSubmitting(true);
    try {
      const updated = await markInvoicePaid(invoice.id);
      notifyInvoicesChanged();
      onUpdated?.(updated);
      toast.success(t("toast.invoiceMarkedPaid"), { description: updated.number });
    } catch (err) {
      toast.error(err.message || t("toast.invoicePaymentError"));
    } finally {
      setSubmitting(false);
    }
  };

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

  if (status === "paid") {
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleReopen}
        disabled={submitting}
        className={compact ? "h-8 gap-1 text-xs" : "gap-1.5"}
        data-testid={`invoice-reopen-${invoice.id}`}
      >
        {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
        {t("invoiceForm.markInProgress")}
      </Button>
    );
  }

  if (status === "in_progress" || status === "overdue") {
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleMarkPaid}
        disabled={submitting}
        className={
          compact
            ? "h-8 gap-1 text-xs border-[#A7F3D0] text-[#065F46] hover:bg-[#ECFDF5]"
            : "gap-1.5 border-[#A7F3D0] text-[#065F46] hover:bg-[#ECFDF5]"
        }
        data-testid={`invoice-mark-paid-${invoice.id}`}
      >
        {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
        {t("invoiceForm.markAsPaid")}
      </Button>
    );
  }

  return null;
}
