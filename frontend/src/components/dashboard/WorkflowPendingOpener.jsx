import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAddQuote } from "@/context/AddQuoteContext";
import { useAddInvoice } from "@/context/AddInvoiceContext";
import { commercialDocumentsPath } from "@/utils/commercialDocumentsPath";

const CLIENT_DETAIL_PATH = /^\/dashboard\/clients\/[^/]+$/;

/** Routes pending create → detail to the right page when not already handled locally. */
export default function WorkflowPendingOpener() {
  const navigate = useNavigate();
  const location = useLocation();
  const { pendingOpenQuote, clearPendingOpenQuote } = useAddQuote();
  const { pendingOpenInvoice, clearPendingOpenInvoice } = useAddInvoice();

  const path = location.pathname;
  const handlesQuoteLocally =
    path.startsWith("/dashboard/documents") || CLIENT_DETAIL_PATH.test(path);
  const handlesInvoiceLocally =
    path.startsWith("/dashboard/documents") || CLIENT_DETAIL_PATH.test(path);

  useEffect(() => {
    if (!pendingOpenQuote || handlesQuoteLocally) return;
    const quote = pendingOpenQuote;
    clearPendingOpenQuote();
    navigate(commercialDocumentsPath({ kind: "quote", open: quote.id }));
  }, [pendingOpenQuote, handlesQuoteLocally, clearPendingOpenQuote, navigate]);

  useEffect(() => {
    if (!pendingOpenInvoice || handlesInvoiceLocally) return;
    const invoice = pendingOpenInvoice;
    clearPendingOpenInvoice();
    navigate(commercialDocumentsPath({ kind: "invoice", open: invoice.id }));
  }, [pendingOpenInvoice, handlesInvoiceLocally, clearPendingOpenInvoice, navigate]);

  return null;
}
