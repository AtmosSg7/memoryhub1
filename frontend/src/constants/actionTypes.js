/** Action Engine — shared type / status / priority constants (no UI page yet). */

/** @typedef {'pending'|'completed'|'dismissed'|'expired'} ActionStatus */
/** @typedef {'low'|'normal'|'high'|'urgent'} ActionPriority */

export const ACTION_STATUSES = Object.freeze([
  "pending",
  "completed",
  "dismissed",
  "expired",
]);

export const ACTION_PRIORITIES = Object.freeze([
  "low",
  "normal",
  "high",
  "urgent",
]);

export const ACTION_TYPES = Object.freeze({
  REPLY_TO_PROSPECT: "reply_to_prospect",
  READ_CLIENT_REPLY: "read_client_reply",
  CALL_BACK: "call_back",
  FOLLOW_UP_OVERDUE_INVOICE: "follow_up_overdue_invoice",
  CREATE_INVOICE_FROM_QUOTE: "create_invoice_from_quote",
  PREPARE_QUOTE: "prepare_quote",
  HANDLE_COMPLAINT: "handle_complaint",
  ANSWER_QUESTION: "answer_question",
  FOLLOW_UP_COMMUNICATION: "follow_up_communication",
  REVIEW_PAYMENT: "review_payment",
  REVIEW_DOCUMENT: "review_document",
  SCHEDULE_APPOINTMENT: "schedule_appointment",
});
