/**
 * Resolve navigation target for a universal search result.
 */

export function resolveSearchNavigation(item) {
  if (!item) return "/dashboard/search";
  const target = item.navigationTarget || item.url;
  if (target) return target;

  switch (item.type) {
    case "client":
      return item.id ? `/dashboard/clients/${item.id}` : "/dashboard/clients";
    case "prospect":
      return item.id ? `/dashboard/prospects?open=${encodeURIComponent(item.id)}` : "/dashboard/prospects";
    case "quote":
    case "invoice":
      return item.id ? `/dashboard/documents?open=${encodeURIComponent(item.id)}` : "/dashboard/documents";
    case "conversation": {
      const convId = item.id || item.metadata?.conversationId;
      if (item.clientId && convId) {
        return `/dashboard/clients/${item.clientId}?section=emails&conversation=${encodeURIComponent(convId)}`;
      }
      if (convId) {
        return `/dashboard/communications?conversation=${encodeURIComponent(convId)}`;
      }
      return item.clientId
        ? `/dashboard/clients/${item.clientId}?section=emails`
        : "/dashboard/communications";
    }
    case "email":
    case "communication": {
      const convId = item.metadata?.conversationId;
      if (item.clientId && convId) {
        return `/dashboard/clients/${item.clientId}?section=emails&conversation=${encodeURIComponent(convId)}`;
      }
      if (item.clientId) {
        return `/dashboard/clients/${item.clientId}?section=emails`;
      }
      if (convId) {
        return `/dashboard/communications?conversation=${encodeURIComponent(convId)}`;
      }
      return item.id
        ? `/dashboard/communications?open=${encodeURIComponent(item.id)}`
        : "/dashboard/communications";
    }
    case "action":
      if (item.metadata?.conversationId && item.clientId) {
        return `/dashboard/clients/${item.clientId}?section=emails&conversation=${encodeURIComponent(item.metadata.conversationId)}`;
      }
      if (item.sourceId) {
        return `/dashboard/communications?open=${encodeURIComponent(item.sourceId)}`;
      }
      if (item.clientId) {
        return `/dashboard/clients/${item.clientId}?section=emails`;
      }
      return "/dashboard";
    case "note":
      return item.clientId
        ? `/dashboard/clients/${item.clientId}?section=notes`
        : "/dashboard/notes";
    case "document":
      return item.clientId
        ? `/dashboard/clients/${item.clientId}?section=documents`
        : "/dashboard/files";
    default:
      return "/dashboard/search";
  }
}
