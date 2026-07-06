import { formatInvoiceAmount } from "@/utils/invoiceDisplay";
import { formatQuoteAmount } from "@/utils/quoteDisplay";
import { getEventRoute } from "@/utils/eventDisplay";

export const COMMUNICATION_CATEGORIES = [
  "all",
  "note",
  "payment",
  "quote_acceptance",
  "follow_up",
  "document_send",
  "email",
  "commercial",
];

export function communicationToEvent(item) {
  if (!item?.eventType) return null;
  return {
    id: item.id,
    type: item.eventType,
    entityType: item.entityType,
    entityId: item.entityId,
    clientId: item.clientId,
    metadata: item.metadata || {},
    createdAt: item.occurredAt,
  };
}

export function getCommunicationRoute(item) {
  const event = communicationToEvent(item);
  if (event) return getEventRoute(event);
  if (item?.clientId) return `/dashboard/clients/${item.clientId}`;
  return null;
}

export function formatCommunicationAmount(item, lang) {
  if (item?.amount == null) return null;
  if (item.category === "payment" || item.category === "commercial") {
    if (item.eventType?.startsWith("invoice") || item.metadata?.invoiceNumber) {
      return formatInvoiceAmount(item.amount, lang);
    }
    return formatQuoteAmount(item.amount, lang);
  }
  return formatQuoteAmount(item.amount, lang);
}

export function getCommunicationCategoryKey(category) {
  return `communications.categories.${category}`;
}

export function getCommunicationChannelKey(channel) {
  return `communications.channels.${channel || "app"}`;
}
