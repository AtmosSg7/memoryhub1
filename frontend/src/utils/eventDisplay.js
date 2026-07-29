import { formatLastInteraction } from "./clientDisplay";
import { formatFileSize } from "./documentDisplay";
import { formatNoteDate, getNoteTypeLabel } from "./noteDisplay";
import { formatQuoteAmount, formatQuoteDate } from "./quoteDisplay";
import { formatInvoiceAmount, formatInvoiceDate } from "./invoiceDisplay";
import { commercialDocumentsPath } from "./commercialDocumentsPath";

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
  quote_rejected: "activity.quoteRejected",
  quote_deleted: "activity.quoteDeleted",
  quote_converted: "activity.quoteConverted",
  quote_sent: "activity.quoteSent",
  quote_viewed: "activity.quoteViewed",
  quote_expired: "activity.quoteExpired",
  quote_archived: "activity.quoteArchived",
  invoice_created: "activity.invoiceCreated",
  invoice_updated: "activity.invoiceUpdated",
  invoice_deleted: "activity.invoiceDeleted",
  invoice_paid: "activity.invoicePaid",
  invoice_payment_recorded: "activity.invoicePaymentRecorded",
  invoice_reopened: "activity.invoiceReopened",
  invoice_overdue: "activity.invoiceOverdue",
  invoice_issued: "activity.invoiceIssued",
  invoice_sent: "activity.invoiceSent",
  invoice_viewed: "activity.invoiceViewed",
  invoice_archived: "activity.invoiceArchived",
  invoice_validated: "activity.invoiceValidated",
  invoice_validation_failed: "activity.invoiceValidationFailed",
  invoice_ready_for_export: "activity.invoiceReadyForExport",
  invoice_exported: "activity.invoiceExported",
  follow_up_recorded: "activity.followUpRecorded",
  document_send_prepared: "activity.documentSendPrepared",
  // Future channels — reserved labels
  call_logged: "activity.callLogged",
  email_sent: "activity.emailSent",
  email_received: "activity.emailReceived",
  whatsapp_message: "activity.whatsappMessage",
  calendar_event_synced: "activity.calendarEventSynced",
  contacts_synced: "activity.contactsSynced",
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
  quote_rejected: "quote",
  quote_deleted: "quote",
  quote_converted: "invoice",
  quote_sent: "quote",
  quote_viewed: "quote",
  quote_expired: "quote",
  quote_archived: "quote",
  invoice_created: "invoice",
  invoice_updated: "invoice",
  invoice_deleted: "invoice",
  invoice_paid: "invoice",
  invoice_payment_recorded: "invoice",
  invoice_reopened: "invoice",
  invoice_overdue: "invoice",
  invoice_issued: "invoice",
  invoice_sent: "invoice",
  invoice_viewed: "invoice",
  invoice_archived: "invoice",
  invoice_validated: "invoice",
  invoice_validation_failed: "invoice",
  invoice_ready_for_export: "invoice",
  invoice_exported: "invoice",
  follow_up_recorded: "follow_up",
  document_send_prepared: "send",
  call_logged: "call",
  email_sent: "email",
  email_received: "email",
  whatsapp_message: "whatsapp",
  calendar_event_synced: "calendar",
  contacts_synced: "contacts",
};

const QUOTE_TYPES = new Set([
  "quote_created",
  "quote_updated",
  "quote_accepted",
  "quote_rejected",
  "quote_deleted",
  "quote_sent",
  "quote_viewed",
  "quote_expired",
  "quote_archived",
]);

const INVOICE_TYPES = new Set([
  "invoice_created",
  "invoice_updated",
  "invoice_deleted",
  "invoice_paid",
  "invoice_payment_recorded",
  "invoice_reopened",
  "invoice_overdue",
  "invoice_issued",
  "invoice_sent",
  "invoice_viewed",
  "invoice_archived",
  "invoice_validated",
  "invoice_validation_failed",
  "invoice_ready_for_export",
  "invoice_exported",
]);

export function getEventLabelKey(type) {
  return LABEL_KEYS[type] || "activity.clientUpdated";
}

export function getEventIconType(type) {
  return ICON_TYPES[type] || "client";
}

export function formatEventTime(createdAt, lang = "fr") {
  return formatLastInteraction(createdAt, lang);
}

export function isImportEvent(metadata) {
  return metadata?.source === "import" || Boolean(metadata?.importSessionId);
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

    case "quote_converted":
      return joinParts([
        metadata.quoteNumber,
        metadata.invoiceNumber,
        metadata.title,
        metadata.clientName,
        metadata.amountTTC != null ? formatQuoteAmount(metadata.amountTTC, lang) : "",
      ]);

    case "follow_up_recorded":
    case "document_send_prepared":
      return joinParts([
        metadata.documentNumber || metadata.quoteNumber || metadata.invoiceNumber,
        metadata.excerpt,
        metadata.clientName,
      ]);

    default:
      if (QUOTE_TYPES.has(type)) {
        return joinParts([
          metadata.quoteNumber,
          metadata.title,
          metadata.clientName,
          metadata.amountTTC != null ? formatQuoteAmount(metadata.amountTTC, lang) : "",
          metadata.quoteDate ? formatQuoteDate(metadata.quoteDate, lang) : "",
        ]);
      }
      if (INVOICE_TYPES.has(type)) {
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
      }
      return metadata.clientName || metadata.noteTitle || metadata.fileName || metadata.subject || "";
  }
}

export function getEventRoute(event) {
  if (!event?.entityId && event?.entityType !== "client") {
    // Groups / future events may still deep-link via clientId
    if (event?.clientId) {
      return `/dashboard/clients/${event.clientId}`;
    }
    return null;
  }

  const { entityType, entityId, clientId } = event;

  if (entityType === "client") {
    return `/dashboard/clients/${entityId || clientId}`;
  }
  if (entityType === "quote") {
    return commercialDocumentsPath({ kind: "quote", open: entityId });
  }
  if (entityType === "invoice") {
    return commercialDocumentsPath({ kind: "invoice", open: entityId });
  }
  if (entityType === "note") {
    if (clientId) return `/dashboard/clients/${clientId}?section=notes`;
    return "/dashboard/notes";
  }
  if (entityType === "document") {
    if (clientId) return `/dashboard/clients/${clientId}?section=documents`;
    return "/dashboard/files";
  }
  // Future channels — deep-link to client hub until dedicated surfaces exist
  if (["call", "email", "whatsapp", "calendar", "contacts"].includes(entityType)) {
    if (clientId) return `/dashboard/clients/${clientId}?section=timeline`;
  }
  return null;
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

    case "quote_converted":
      clientName = metadata.clientName || null;
      amount = metadata.amountTTC != null ? formatQuoteAmount(metadata.amountTTC, lang) : null;
      subtitle = joinParts([metadata.quoteNumber, metadata.invoiceNumber, metadata.title]);
      break;

    case "follow_up_recorded":
    case "document_send_prepared":
      clientName = metadata.clientName || null;
      subtitle = joinParts([
        metadata.documentNumber || metadata.quoteNumber || metadata.invoiceNumber,
        metadata.excerpt,
      ]);
      break;

    case "call_logged":
    case "email_sent":
    case "email_received":
    case "whatsapp_message":
    case "calendar_event_synced":
    case "contacts_synced":
      clientName = metadata.clientName || null;
      subtitle = metadata.subject || metadata.excerpt || metadata.title || "";
      break;

    default:
      if (QUOTE_TYPES.has(type)) {
        clientName = metadata.clientName || null;
        amount = metadata.amountTTC != null ? formatQuoteAmount(metadata.amountTTC, lang) : null;
        subtitle = joinParts([metadata.quoteNumber, metadata.title]);
        break;
      }
      if (INVOICE_TYPES.has(type)) {
        clientName = metadata.clientName || null;
        amount = metadata.amountDue != null
          ? formatInvoiceAmount(metadata.amountDue, lang)
          : metadata.paymentAmount != null
            ? formatInvoiceAmount(metadata.paymentAmount, lang)
            : metadata.amountTTC != null
              ? formatInvoiceAmount(metadata.amountTTC, lang)
              : null;
        subtitle = joinParts([metadata.invoiceNumber, metadata.title]);
        break;
      }
      clientName = metadata.clientName || null;
      subtitle = metadata.noteTitle || metadata.fileName || metadata.quoteNumber || metadata.invoiceNumber || "";
      break;
  }

  return {
    labelKey: getEventLabelKey(type),
    iconType: getEventIconType(type),
    clientName,
    amount,
    subtitle,
    isImport,
  };
}
