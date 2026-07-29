export function parseReminderEntityId(reminder) {
  if (!reminder?.id) return null;
  const colon = reminder.id.indexOf(":");
  return colon >= 0 ? reminder.id.slice(colon + 1) : null;
}

export function getReminderDocType(reminder) {
  if (reminder.type === "import_pending" || reminder.type === "personal_reminder") return null;
  if (reminder.type.startsWith("invoice")) return "invoice";
  if (reminder.type.startsWith("quote")) return "quote";
  return null;
}

export function getReminderActionKey(reminder) {
  if (reminder.type === "import_pending" || reminder.type === "personal_reminder") return "view";
  if (reminder.type === "invoice_overdue" || reminder.type === "invoice_unpaid") return "collect";
  if (reminder.type.startsWith("invoice")) return "followUp";
  if (reminder.type === "quote_no_response" || reminder.type === "quote_expiring_soon") {
    return "followUp";
  }
  return "view";
}
