const COLORS = ["#0A2540", "#173A5E", "#0066FF", "#4B5563", "#065F46"];

export function getClientInitials(client) {
  const company = client.company?.trim();
  const name = (client.contactName || client.name)?.trim();

  if (company) {
    const parts = company.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return company.slice(0, 2).toUpperCase();
  }

  if (name) {
    const parts = name.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  }

  return "??";
}

export function getClientColor(clientId) {
  let hash = 0;
  for (let i = 0; i < clientId.length; i += 1) {
    hash = clientId.charCodeAt(i) + ((hash << 5) - hash);
  }
  return COLORS[Math.abs(hash) % COLORS.length];
}

export function getDisplayCompany(client) {
  return client.company?.trim() || client.name;
}

export function getDisplayName(client) {
  return client.contactName?.trim() || client.name;
}

export function formatLastInteraction(updatedAt, lang = "fr") {
  if (!updatedAt) {
    return lang === "fr" ? "Jamais" : "Never";
  }

  const date = new Date(updatedAt);
  if (Number.isNaN(date.getTime())) {
    return updatedAt;
  }

  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 60) {
    if (lang === "fr") {
      return diffMins <= 1 ? "À l'instant" : `Il y a ${diffMins} min`;
    }
    return diffMins <= 1 ? "Just now" : `${diffMins} min ago`;
  }

  if (diffHours < 24) {
    return lang === "fr" ? `Il y a ${diffHours} h` : `${diffHours} h ago`;
  }

  if (diffDays === 1) {
    return lang === "fr" ? "Hier" : "Yesterday";
  }

  if (diffDays < 30) {
    return lang === "fr" ? `Il y a ${diffDays} jours` : `${diffDays} days ago`;
  }

  return date.toLocaleDateString(lang === "fr" ? "fr-FR" : "en-US");
}
