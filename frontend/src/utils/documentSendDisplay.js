export function canSendDocument(entityType, entity) {
  if (!entity?.id) return false;
  if (entityType === "quote") {
    return !["rejected", "expired"].includes(entity.status);
  }
  if (entityType === "invoice") {
    const status = entity.status === "draft" || entity.status === "sent" ? "in_progress" : entity.status;
    return status !== "cancelled";
  }
  return false;
}
