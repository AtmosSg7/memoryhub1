export function prospectDisplayName(prospect) {
  return (
    prospect?.displayName?.trim() ||
    prospect?.company?.trim() ||
    prospect?.email?.trim() ||
    prospect?.phone?.trim() ||
    "—"
  );
}

export function formatProspectDate(value, lang) {
  if (!value) return "—";
  try {
    return new Intl.DateTimeFormat(lang === "en" ? "en-GB" : "fr-FR", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

export function formatProspectDateShort(value, lang) {
  if (!value) return "—";
  try {
    return new Intl.DateTimeFormat(lang === "en" ? "en-GB" : "fr-FR", {
      dateStyle: "medium",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

export function prospectPrefill(prospect) {
  return {
    name: prospectDisplayName(prospect) === "—" ? "" : prospectDisplayName(prospect),
    contactName: prospect?.displayName || "",
    email: prospect?.email || "",
    phone: prospect?.phone || "",
    company: prospect?.company || "",
  };
}
