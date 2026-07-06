const PRIORITY_STYLES = {
  critical: {
    badge: "bg-[#FEF2F2] text-[#991B1B] border-[#FECACA]",
    border: "border-[#FECACA] hover:bg-[#FEF2F2]",
  },
  high: {
    badge: "bg-[#FEF2F2] text-[#991B1B] border-[#FECACA]",
    border: "border-[#FECACA] hover:bg-[#FEF2F2]",
  },
  medium: {
    badge: "bg-[#FFFBEB] text-[#92400E] border-[#FDE68A]",
    border: "border-[#F3F4F6] hover:border-[#FDE68A] hover:bg-[#FAFAFA]",
  },
  low: {
    badge: "bg-[#F3F4F6] text-[#4B5563] border-[#E5E7EB]",
    border: "border-[#F3F4F6] hover:border-[#E5E7EB] hover:bg-[#FAFAFA]",
  },
};

export function getReminderPriorityStyle(priority) {
  return PRIORITY_STYLES[priority] || PRIORITY_STYLES.medium;
}

export function getReminderPriorityLabelKey(priority) {
  return `reminders.priority.${priority}`;
}

export function formatReminderDate(dateValue, lang = "fr") {
  if (!dateValue) return "";
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return dateValue;
  return date.toLocaleDateString(lang === "fr" ? "fr-FR" : "en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
