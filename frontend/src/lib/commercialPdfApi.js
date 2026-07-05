import { API_BASE } from "@/lib/api";
import { triggerBlobDownload } from "@/lib/documentsApi";

function parseError(data, fallback) {
  const detail = data?.detail;
  if (typeof detail === "string") return detail;
  if (detail?.message) return detail.message;
  return fallback;
}

function filenameFromDisposition(header) {
  if (!header) return null;
  const match = header.match(/filename="([^"]+)"/);
  return match ? match[1] : null;
}

async function fetchCommercialPdf(path, lang) {
  const params = new URLSearchParams();
  if (lang) params.set("lang", lang);
  const query = params.toString() ? `?${params.toString()}` : "";
  const res = await fetch(`${API_BASE}${path}${query}`, { credentials: "include" });
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new Error(parseError(data, "Failed to download PDF."));
  }
  const blob = await res.blob();
  const filename = filenameFromDisposition(res.headers.get("Content-Disposition"));
  return { blob, filename };
}

export async function downloadQuotePdf(quoteId, { lang, number } = {}) {
  const { blob, filename } = await fetchCommercialPdf(`/api/quotes/${quoteId}/pdf`, lang);
  triggerBlobDownload(blob, filename || `${number || "quote"}.pdf`);
}

export async function downloadInvoicePdf(invoiceId, { lang, number } = {}) {
  const { blob, filename } = await fetchCommercialPdf(`/api/invoices/${invoiceId}/pdf`, lang);
  triggerBlobDownload(blob, filename || `${number || "invoice"}.pdf`);
}
