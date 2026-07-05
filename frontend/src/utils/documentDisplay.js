const PREVIEW_EXTENSIONS = new Set(["pdf", "jpg", "jpeg", "png", "webp"]);

const TYPE_COLORS = {
  pdf: { bg: "bg-[#FEF2F2]", text: "text-[#991B1B]", label: "PDF" },
  zip: { bg: "bg-[#FFFBEB]", text: "text-[#92400E]", label: "ZIP" },
  dwg: { bg: "bg-[#EFF6FF]", text: "text-[#0A2540]", label: "DWG" },
  doc: { bg: "bg-[#EFF6FF]", text: "text-[#0A2540]", label: "DOC" },
  docx: { bg: "bg-[#EFF6FF]", text: "text-[#0A2540]", label: "DOCX" },
  xls: { bg: "bg-[#ECFDF5]", text: "text-[#065F46]", label: "XLS" },
  xlsx: { bg: "bg-[#ECFDF5]", text: "text-[#065F46]", label: "XLSX" },
  jpg: { bg: "bg-[#F3F4F6]", text: "text-[#4B5563]", label: "JPG" },
  jpeg: { bg: "bg-[#F3F4F6]", text: "text-[#4B5563]", label: "JPEG" },
  png: { bg: "bg-[#F3F4F6]", text: "text-[#4B5563]", label: "PNG" },
  webp: { bg: "bg-[#F3F4F6]", text: "text-[#4B5563]", label: "WEBP" },
};

export function formatFileSize(bytes, lang = "fr") {
  if (bytes == null || Number.isNaN(bytes)) return "—";
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) {
    const kb = bytes / 1024;
    return lang === "fr" ? `${kb.toFixed(kb >= 10 ? 0 : 1)} Ko` : `${kb.toFixed(kb >= 10 ? 0 : 1)} KB`;
  }
  const mb = bytes / (1024 * 1024);
  return lang === "fr" ? `${mb.toFixed(1)} Mo` : `${mb.toFixed(1)} MB`;
}

export function getDocumentExtension(doc) {
  return (doc?.extension || "").toLowerCase();
}

export function canPreviewDocument(doc) {
  return PREVIEW_EXTENSIONS.has(getDocumentExtension(doc));
}

export function getDocumentTypeStyle(doc) {
  const ext = getDocumentExtension(doc);
  return (
    TYPE_COLORS[ext] || {
      bg: "bg-[#F3F4F6]",
      text: "text-[#4B5563]",
      label: ext.toUpperCase() || "FILE",
    }
  );
}

export const ALLOWED_EXTENSIONS_LABEL =
  "PDF · JPG · JPEG · PNG · WEBP · ZIP · DWG · DOC · DOCX · XLS · XLSX";

export const MAX_UPLOAD_MB = 25;
