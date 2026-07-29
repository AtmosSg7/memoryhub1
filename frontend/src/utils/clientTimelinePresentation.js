import {
  getEventIconType,
  getEventPresentation,
  getEventRoute,
  isImportEvent,
} from "@/utils/eventDisplay";
import {
  getGroupFileNames,
  getGroupedDocumentsRoute,
} from "@/utils/clientTimeline";

/** Presentation for a single or grouped timeline item (UI layer). */
export function getTimelineItemPresentation(item, lang = "fr", t) {
  if (item.kind === "group") {
    const names = getGroupFileNames(item);
    const preview = names.slice(0, 3).join(", ");
    const extra = names.length > 3 ? ` (+${names.length - 3})` : "";
    const isImport = item.events.some((event) => isImportEvent(event.metadata));
    const titleKey =
      item.type === "document_deleted"
        ? "clientTimeline.group.documentDeleted"
        : isImport
          ? "clientTimeline.group.documentImported"
          : "clientTimeline.group.documentUploaded";

    const title = t
      ? t(titleKey).replace("{count}", String(item.count))
      : `${item.count} files`;

    return {
      title,
      description: preview ? `${preview}${extra}` : "",
      route: getGroupedDocumentsRoute(item),
      iconType: "document",
      isImport,
      isGroup: true,
      count: item.count,
      channel: item.channel,
    };
  }

  const event = item.event;
  const presentation = getEventPresentation(event, lang);
  const title = t ? t(presentation.labelKey) : presentation.labelKey;
  const importSuffix =
    presentation.isImport && t
      ? ` · ${t("activity.viaImport")}`
      : presentation.isImport
        ? " · Import"
        : "";

  const descriptionParts = [];
  if (presentation.amount) descriptionParts.push(presentation.amount);
  if (presentation.subtitle) descriptionParts.push(presentation.subtitle);
  if (!descriptionParts.length && presentation.clientName) {
    descriptionParts.push(presentation.clientName);
  }

  return {
    title: `${title}${importSuffix}`,
    description: descriptionParts.filter(Boolean).join(" · "),
    route: getEventRoute(event),
    iconType: presentation.iconType || getEventIconType(event?.type),
    isImport: presentation.isImport,
    isGroup: false,
    count: 1,
    channel: item.channel,
    labelKey: presentation.labelKey,
  };
}
