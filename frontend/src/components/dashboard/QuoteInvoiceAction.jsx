import { Upload, ExternalLink, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { toast } from "sonner";
import { useDashboardLang } from "@/hooks/useDashboardLang";
import { useAddQuote } from "@/context/AddQuoteContext";
import { useAddInvoice } from "@/context/AddInvoiceContext";
import { getInvoice } from "@/lib/invoicesApi";
import { ActionButton } from "@/components/dashboard/ActionButton";

/**
 * Pivot UX: Basera no longer creates invoices from quotes.
 * Accepted quotes → import the final invoice; linked invoice → open/view.
 */
export default function QuoteInvoiceAction({ quote, compact = false, prominent = false }) {
  const { t } = useDashboardLang();
  const navigate = useNavigate();
  const { notifyQuotesChanged } = useAddQuote();
  const { queueOpenInvoice } = useAddInvoice();
  const [submitting, setSubmitting] = useState(false);

  if (!quote) return null;

  const hasLinkedInvoice = Boolean(quote.invoiceId);
  const clientId = quote.clientId;

  const openInvoice = (invoice) => {
    queueOpenInvoice(invoice);
    if (clientId) return;
    navigate(`/dashboard/documents?open=${invoice.id}`);
  };

  const handleViewInvoice = async () => {
    if (!quote.invoiceId) return;
    setSubmitting(true);
    try {
      const invoice = await getInvoice(quote.invoiceId);
      openInvoice(invoice);
    } catch (err) {
      if (err.message?.includes("not found") || err.message?.includes("introuvable")) {
        notifyQuotesChanged();
        toast.error(t("toast.linkedInvoiceMissing"));
      } else if (clientId) {
        navigate(`/dashboard/clients/${clientId}?section=invoices`);
      } else {
        navigate("/dashboard/documents");
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (hasLinkedInvoice) {
    return (
      <ActionButton
        variant="quick"
        onClick={handleViewInvoice}
        disabled={submitting}
        className={compact ? undefined : "h-10 px-4 text-sm"}
        data-testid={`quote-view-invoice-${quote.id}`}
      >
        {submitting ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <ExternalLink className="w-3.5 h-3.5" />
        )}
        {t("actions.viewInvoice")}
      </ActionButton>
    );
  }

  if (quote.status !== "accepted") return null;

  return (
    <ActionButton
      variant={prominent ? "primary" : "accent"}
      onClick={() => navigate("/dashboard/documents?import=1")}
      className={compact ? "gap-1.5" : "h-10 px-4 text-sm gap-1.5"}
      data-testid={`quote-import-invoice-${quote.id}`}
    >
      <Upload className="w-3.5 h-3.5" />
      {t("documentActions.importDocument")}
    </ActionButton>
  );
}
