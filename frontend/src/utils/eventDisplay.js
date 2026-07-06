import { formatLastInteraction } from "@/utils/clientDisplay";
import { formatFileSize } from "@/utils/documentDisplay";
import { formatNoteDate, getNoteTypeLabel } from "@/utils/noteDisplay";
import { formatQuoteAmount, formatQuoteDate } from "@/utils/quoteDisplay";
import { formatInvoiceAmount, formatInvoiceDate } from "@/utils/invoiceDisplay";

const LABEL_KEYS = {
  client_created: "activity.clientCreated",
  client_updated: "activity.clientUpdated",
  note_created: "activity.noteCreated",
  note_updated: "activity.noteUpdated",
  note_deleted: "activity.noteDeleted",
  document_uploaded: "activity.documentUploaded",
  document_deleted: "activity.documentDeleted",
  quote_created: "activity.quoteCreated",
  quote_updated: "activity.quoteUpdated",
  quote_accepted: "activity.quoteAccepted",
  quote_deleted: "activity.quoteDeleted",
  quote_converted: "activity.quoteConverted",
  invoice_created: "activity.invoiceCreated",
  invoice_updated: "activity.invoiceUpdated",
  invoice_deleted: "activity.invoiceDeleted",
  invoice_paid: "activity.invoicePaid",
  invoice_payment_recorded: "activity.invoicePaymentRecorded",
  invoice_reopened: "activity.invoiceReopened",
  follow_up_recorded: "activity.followUpRecorded",
  document_send_prepared: "activity.documentSendPrepared",
};

const ICON_TYPES = {
  client_created: "client",
  client_updated: "client",
  note_created: "note",
  note_updated: "note",
  note_deleted: "note",
  document_uploaded: "document",
  document_deleted: "document",
  quote_created: "quote",
  quote_updated: "quote",
  quote_accepted: "quote",
  quote_deleted: "quote",
  quote_converted: "invoice",
  invoice_created: "invoice",
  invoice_updated: "invoice",
  invoice_deleted: "invoice",
  invoice_paid: "invoice",
  invoice_payment_recorded: "invoice",
  invoice_reopened: "invoice",
  follow_up_recorded: "quote",
  document_send_prepared: "quote",
};

export function getEventLabelKey(type) {
  return LABEL_KEYS[type] || "activity.clientUpdated";
}

export function getEventIconType(type) {
  return ICON_TYPES[type] || "client";
}

export function formatEventTime(createdAt, lang = "fr") {
  return formatLastInteraction(createdAt, lang);
}

function joinParts(parts) {
  return parts.filter(Boolean).join(" — ");
}

export function getEventDetail(event, lang = "fr") {
  const metadata = event?.metadata || {};
  const { type } = event;

  switch (type) {
    case "client_created":
    case "client_updated":
      return metadata.clientName || "";

    case "note_created": {
      const title = metadata.noteTitle || "";
      const client = metadata.clientName;
      const typeLabel = metadata.noteType
        ? getNoteTypeLabel(metadata.noteType, lang)
        : "";
      const datePart = metadata.noteDate ? formatNoteDate(metadata.noteDate, lang) : "";
      const prefix = [typeLabel, datePart].filter(Boolean).join(" — ");
      if (metadata.excerpt) {
        const quote = lang === "fr" ? `« ${metadata.excerpt} »` : `"${metadata.excerpt}"`;
        if (client) {
          return prefix
            ? `${prefix} — ${client} : ${quote}`
            : `${title} — ${client} : ${quote}`;
        }
        return prefix ? `${prefix} : ${quote}` : lang === "fr" ? `Note : ${quote}` : `Note: ${quote}`;
      }
      return joinParts([prefix || title, client]);
    }

    case "note_updated":
    case "note_deleted": {
      const typeLabel = metadata.noteType
        ? getNoteTypeLabel(metadata.noteType, lang)
        : "";
      const datePart = metadata.noteDate ? formatNoteDate(metadata.noteDate, lang) : "";
      return joinParts([typeLabel, datePart, metadata.noteTitle, metadata.clientName]);
    }

    case "document_uploaded": {
      const fileName = metadata.fileName || "";
      const client = metadata.clientName;
      const size =
        metadata.size != null ? formatFileSize(metadata.size) : null;
      const parts = [fileName, client];
      if (size) {
        parts.push(size);
      }
      return joinParts(parts);
    }

    case "document_deleted":
      return joinParts([metadata.fileName, metadata.clientName]);

    case "quote_created":
    case "quote_updated":
    case "quote_accepted":
    case "quote_deleted":
      return joinParts([
        metadata.quoteNumber,
        metadata.title,
        metadata.clientName,
        metadata.amountTTC != null ? formatQuoteAmount(metadata.amountTTC, lang) : "",
        metadata.quoteDate ? formatQuoteDate(metadata.quoteDate, lang) : "",
      ]);

    case "quote_converted":
      return joinParts([
        metadata.quoteNumber,
        metadata.invoiceNumber,
        metadata.title,
        metadata.clientName,
        metadata.amountTTC != null ? formatQuoteAmount(metadata.amountTTC, lang) : "",
      ]);

    case "invoice_created":
    case "invoice_updated":
    case "invoice_deleted":
    case "invoice_paid":
    case "invoice_payment_recorded":
    case "invoice_reopened":
      return joinParts([
        metadata.invoiceNumber,
        metadata.title,
        metadata.clientName,
        metadata.paymentAmount != null
          ? formatInvoiceAmount(metadata.paymentAmount, lang)
          : metadata.amountTTC != null
            ? formatInvoiceAmount(metadata.amountTTC, lang)
            : "",
        metadata.amountDue != null ? formatInvoiceAmount(metadata.amountDue, lang) : "",
        metadata.paymentDate ? formatInvoiceDate(metadata.paymentDate, lang) : "",
        metadata.paidAt ? formatInvoiceDate(metadata.paidAt, lang) : "",
      ]);

    case "follow_up_recorded":
      return joinParts([
        metadata.documentNumber || metadata.quoteNumber || metadata.invoiceNumber,
        metadata.excerpt,
        metadata.clientName,
      ]);

    case "document_send_prepared":
      return joinParts([
        metadata.documentNumber || metadata.quoteNumber || metadata.invoiceNumber,
        metadata.excerpt,
        metadata.clientName,
      ]);

    default:
      return metadata.clientName || metadata.noteTitle || metadata.fileName || "";
  }
}

export function getEventRoute(event) {
  if (!event?.entityId) return null;

  const { entityType, entityId, clientId } = event;

  if (entityType === "client") {
    return `/dashboard/clients/${entityId}`;
  }
  if (entityType === "quote") {
    return `/dashboard/quotes?open=${entityId}`;
  }
  if (entityType === "invoice") {
    return `/dashboard/invoices?open=${entityId}`;
  }
  if (entityType === "note") {
    if (clientId) return `/dashboard/clients/${clientId}?section=notes`;
    return "/dashboard/notes";
  }
  if (entityType === "document") {
    if (clientId) return `/dashboard/clients/${clientId}?section=documents`;
    return "/dashboard/documents";
  }
  return null;
}

function isImportEvent(metadata) {
  return metadata?.source === "import" || Boolean(metadata?.importSessionId);
}

/** Structured fields for timeline rows: type, client, amount, subtitle. */
export function getEventPresentation(event, lang = "fr") {
  const metadata = event?.metadata || {};
  const { type } = event;
  const isImport = isImportEvent(metadata);
  let clientName = null;
  let amount = null;
  let subtitle = "";

  switch (type) {
    case "client_created":
    case "client_updated":
      clientName = metadata.clientName || null;
      break;

    case "note_created":
    case "note_updated":
    case "note_deleted":
      clientName = metadata.clientName || null;
      subtitle = joinParts([
        metadata.noteTitle,
        metadata.excerpt ? (lang === "fr" ? `« ${metadata.excerpt} »` : `"${metadata.excerpt}"`) : "",
      ]);
      break;

    case "document_uploaded":
    case "document_deleted":
      clientName = metadata.clientName || null;
      subtitle = joinParts([
        metadata.fileName,
        metadata.size != null ? formatFileSize(metadata.size) : "",
      ]);
      break;

    case "quote_created":
    case "quote_updated":
    case "quote_accepted":
    case "quote_deleted":
      clientName = metadata.clientName || null;
      amount = metadata.amountTTC != null ? formatQuoteAmount(metadata.amountTTC, lang) : null;
      subtitle = joinParts([metadata.quoteNumber, metadata.title]);
      break;

    case "quote_converted":
      clientName = metadata.clientName || null;
      amount = metadata.amountTTC != null ? formatQuoteAmount(metadata.amountTTC, lang) : null;
      subtitle = joinParts([metadata.quoteNumber, metadata.invoiceNumber, metadata.title]);
      break;

    case "invoice_created":
    case "invoice_updated":
    case "invoice_deleted":
    case "invoice_paid":
    case "invoice_payment_recorded":
    case "invoice_reopened":
      clientName = metadata.clientName || null;
      amount = metadata.paymentAmount != null
        ? formatInvoiceAmount(metadata.paymentAmount, lang)
        : metadata.amountTTC != null
          ? formatInvoiceAmount(metadata.amountTTC, lang)
          : null;
      subtitle = joinParts([metadata.invoiceNumber, metadata.title]);
      break;

    case "follow_up_recorded":
      clientName = metadata.clientName || null;
      subtitle = joinParts([
        metadata.documentNumber || metadata.quoteNumber || metadata.invoiceNumber,
        metadata.excerpt,
      ]);
      break;

    case "document_send_prepared":
      clientName = metadata.clientName || null;
      subtitle = joinParts([
        metadata.documentNumber || metadata.quoteNumber || metadata.invoiceNumber,
        metadata.excerpt,
      ]);
      break;

    default:
      clientName = metadata.clientName || null;
      subtitle = metadata.noteTitle || metadata.fileName || metadata.quoteNumber || metadata.invoiceNumber || "";
      break;
  }

  return {
    labelKey: getEventLabelKey(type),
    clientName,
    amount,
    subtitle,
    isImport,
  };
}
