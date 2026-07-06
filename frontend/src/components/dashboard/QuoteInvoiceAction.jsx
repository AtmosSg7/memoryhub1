import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ExternalLink, Loader2, Receipt } from "lucide-react";
import { toast } from "sonner";
import { useDashboardLang } from "@/hooks/useDashboardLang";
import { useAddQuote } from "@/context/AddQuoteContext";
import { useAddInvoice } from "@/context/AddInvoiceContext";
import { convertQuoteToInvoice } from "@/lib/quotesApi";
import { getInvoice } from "@/lib/invoicesApi";
import { ActionButton } from "@/components/dashboard/ActionButton";

export default function QuoteInvoiceAction({ quote, compact = false, prominent = false }) {
  const { t } = useDashboardLang();
  const navigate = useNavigate();
  const { notifyQuotesChanged } = useAddQuote();
  const { notifyInvoicesChanged, openEditInvoice } = useAddInvoice();
  const [submitting, setSubmitting] = useState(false);

  if (!quote) return null;

  const hasLinkedInvoice = Boolean(quote.invoiceId);

  const handleViewInvoice = async () => {
    if (!quote.invoiceId) return;
    setSubmitting(true);
    try {
      const invoice = await getInvoice(quote.invoiceId);
      openEditInvoice(invoice);
    } catch (err) {
      if (err.message?.includes("not found") || err.message?.includes("introuvable")) {
        notifyQuotesChanged();
        toast.error(t("toast.linkedInvoiceMissing"));
      } else {
        navigate(`/dashboard/clients/${quote.clientId}?section=invoices`);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleConvert = async () => {
    setSubmitting(true);
    try {
      const invoice = await convertQuoteToInvoice(quote.id);
      notifyQuotesChanged();
      notifyInvoicesChanged();
      toast.success(t("toast.invoiceCreatedFromQuote"), {
        description: invoice.number,
      });
      openEditInvoice(invoice);
    } catch (err) {
      if (err.message?.includes("déjà été converti") || err.message?.includes("already")) {
        notifyQuotesChanged();
      }
      toast.error(err.message || t("toast.quoteConvertError"));
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
      onClick={handleConvert}
      disabled={submitting}
      className={compact ? "gap-1.5" : "h-10 px-4 text-sm gap-1.5"}
      data-testid={`quote-create-invoice-${quote.id}`}
    >
      {submitting ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
      ) : (
        <Receipt className="w-3.5 h-3.5" />
      )}
      {t("actions.createInvoiceFromQuote")}
    </ActionButton>
  );
}
