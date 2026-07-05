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
  quote_deleted: "activity.quoteDeleted",
  quote_converted: "activity.quoteConverted",
  invoice_created: "activity.invoiceCreated",
  invoice_updated: "activity.invoiceUpdated",
  invoice_deleted: "activity.invoiceDeleted",
  invoice_paid: "activity.invoicePaid",
  invoice_reopened: "activity.invoiceReopened",
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
  quote_deleted: "quote",
  quote_converted: "invoice",
  invoice_created: "invoice",
  invoice_updated: "invoice",
  invoice_deleted: "invoice",
  invoice_paid: "invoice",
  invoice_reopened: "invoice",
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
    case "invoice_reopened":
      return joinParts([
        metadata.invoiceNumber,
        metadata.title,
        metadata.clientName,
        metadata.amountTTC != null ? formatInvoiceAmount(metadata.amountTTC, lang) : "",
        metadata.invoiceDate ? formatInvoiceDate(metadata.invoiceDate, lang) : "",
        metadata.paidAt ? formatInvoiceDate(metadata.paidAt, lang) : "",
      ]);

    default:
      return metadata.clientName || metadata.noteTitle || metadata.fileName || "";
  }
}
