import { toast } from "sonner";

const ERROR_KEY_BY_MESSAGE = {
  "Failed to load clients.": "errors.loadClients",
  "Failed to load client.": "errors.loadClient",
  "Failed to load quotes.": "errors.loadQuotes",
  "Failed to load quote.": "errors.loadQuote",
  "Failed to load invoices.": "errors.loadInvoices",
  "Failed to load invoice.": "errors.loadInvoice",
  "Failed to load notes.": "errors.loadNotes",
  "Failed to load note.": "errors.loadNote",
  "Failed to load documents.": "errors.loadDocuments",
  "Failed to load document.": "errors.loadDocument",
  "Failed to load catalog.": "errors.loadCatalog",
  "Failed to load communications.": "errors.loadCommunications",
  "Failed to load prospects.": "errors.loadProspects",
  "Failed to load prospect.": "errors.loadProspect",
  "Failed to load prospects count.": "errors.loadProspects",
  "Failed to associate prospect.": "prospects.actionError",
  "Failed to create client from prospect.": "prospects.actionError",
  "Failed to ignore prospect.": "prospects.actionError",
  "Failed to restore prospect.": "prospects.actionError",
  "Search failed.": "errors.loadSearch",
  "Failed to load reminders.": "errors.loadReminders",
  "Failed to load personal reminders.": "errors.loadReminders",
  "Failed to load imports.": "errors.loadImports",
  "Failed to load activity.": "errors.loadActivity",
  "Failed to load follow-ups.": "errors.loadFollowUps",
  "Failed to load timeline.": "errors.loadTimeline",
  "Failed to load portal.": "errors.loadPortal",
  "Invalid request.": "errors.invalidRequest",
  "Validation failed.": "errors.invalidRequest",
  "Only accepted quotes can be converted to an invoice.": "errors.quoteConvertNotAccepted",
  "This quote has already been converted to an invoice.": "errors.quoteAlreadyConverted",
  "Cannot delete a quote that has been converted to an invoice.": "errors.quoteDeleteConverted",
  "Cannot delete this client because they have linked notes, documents, quotes, or invoices.":
    "errors.clientDeleteBlocked",
  "Payment amount exceeds the remaining balance.": "errors.paymentExceedsBalance",
  "Only in-progress or overdue invoices can be marked as paid.": "errors.invoiceMarkPaidInvalid",
  "This invoice is cancelled.": "errors.invoiceCancelled",
  "Only paid or partially paid invoices can be reopened.": "errors.invoiceReopenInvalid",
  "Only in-progress or overdue invoices accept a payment.": "errors.invoicePaymentInvalid",
  "This invoice is already fully paid.": "errors.invoiceFullyPaid",
  "Not authenticated.": "errors.sessionExpired",
  "User not found.": "errors.sessionExpired",
  "Request timed out. Check that the backend is running.": "errors.timeout",
};

const TECHNICAL_PATTERNS = [
  { test: /network error|failed to fetch|load failed/i, key: "errors.network" },
  { test: /timeout|timed out|aborted/i, key: "errors.timeout" },
  { test: /500|internal server error/i, key: "errors.server" },
  { test: /401|unauthorized|session/i, key: "errors.sessionExpired" },
  { test: /gmail.*(sync|fail)|sync.*gmail/i, key: "errors.gmailSync" },
  { test: /analys|import.*(fail|error)|document.*(analys|fail)/i, key: "errors.importAnalyze" },
  { test: /request failed|axioserror|http error/i, key: "errors.loadGeneric" },
  { test: /validation failed|unprocessable/i, key: "errors.invalidRequest" },
];

export function translateApiError(message, t, fallbackKey = "errors.generic") {
  if (!message) return t(fallbackKey);
  const key = ERROR_KEY_BY_MESSAGE[message];
  if (key) return t(key);
  for (const { test, key: patternKey } of TECHNICAL_PATTERNS) {
    if (test.test(message)) return t(patternKey);
  }
  // Hide raw technical payloads from the user when they look like HTTP dumps.
  if (/^\d{3}\s|Request failed|Internal Server Error|Network Error/i.test(message)) {
    return t("errors.loadGeneric");
  }
  return message;
}

export function toastApiError(err, t, fallbackKey = "errors.generic") {
  toast.error(translateApiError(err?.message, t, fallbackKey));
}
