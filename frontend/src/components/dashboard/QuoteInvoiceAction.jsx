import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRightLeft, ExternalLink, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useDashboardLang } from "@/hooks/useDashboardLang";
import { useAddQuote } from "@/context/AddQuoteContext";
import { useAddInvoice } from "@/context/AddInvoiceContext";
import { convertQuoteToInvoice } from "@/lib/quotesApi";
import { getInvoice } from "@/lib/invoicesApi";
import { Button } from "@/components/ui/button";

export default function QuoteInvoiceAction({ quote, compact = false }) {
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
      toast.success(t("toast.quoteConverted"), {
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
      <Button
        type="button"
        variant="outline"
        size={compact ? "sm" : "sm"}
        onClick={handleViewInvoice}
        disabled={submitting}
        className={compact ? "h-8 gap-1 text-xs" : "gap-1.5"}
        data-testid={`quote-view-invoice-${quote.id}`}
      >
        {submitting ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <ExternalLink className="w-3.5 h-3.5" />
        )}
        {quote.invoiceNumber || t("quoteForm.viewInvoice")}
      </Button>
    );
  }

  if (quote.status !== "accepted") return null;

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={handleConvert}
      disabled={submitting}
      className={compact ? "h-8 gap-1 text-xs border-[#BFDBFE] text-[#0A2540] hover:bg-[#EFF6FF]" : "gap-1.5 border-[#BFDBFE] text-[#0A2540] hover:bg-[#EFF6FF]"}
      data-testid={`quote-convert-${quote.id}`}
    >
      {submitting ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
      ) : (
        <ArrowRightLeft className="w-3.5 h-3.5" />
      )}
      {t("quoteForm.convertToInvoice")}
    </Button>
  );
}
