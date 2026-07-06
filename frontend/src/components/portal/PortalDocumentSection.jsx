import { useState } from "react";
import { Download, Eye, Loader2 } from "lucide-react";
import { toast } from "sonner";
import StatusBadge from "@/components/dashboard/StatusBadge";
import PortalAcceptQuoteButton from "@/components/portal/PortalAcceptQuoteButton";
import { formatQuoteAmount, formatQuoteDate } from "@/utils/quoteDisplay";
import { formatInvoiceAmount, formatInvoiceDate, normalizeInvoiceStatus } from "@/utils/invoiceDisplay";
import { downloadPortalInvoicePdf, downloadPortalQuotePdf } from "@/lib/portalPdfApi";
import PortalDocumentDetailModal from "@/components/portal/PortalDocumentDetailModal";

function DocumentRow({ type, item, lang, t, token, canAcceptQuotes, onView, onQuoteAccepted }) {
  const isQuote = type === "quote";
  const date = isQuote
    ? formatQuoteDate(item.quoteDate, lang)
    : formatInvoiceDate(item.invoiceDate, lang);
  const amount = isQuote
    ? formatQuoteAmount(item.amountTTC, lang)
    : formatInvoiceAmount(item.amountTTC, lang);
  const status = isQuote ? item.status : normalizeInvoiceStatus(item.status);
  const showAccept = isQuote && canAcceptQuotes && item.canAccept;

  return (
    <div
      className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-xl border border-[#E7E9EE] bg-white px-4 py-3"
      data-testid={`portal-${type}-${item.id}`}
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2 mb-0.5">
          <span className="font-medium text-sm text-[#111827]">{item.number}</span>
          <StatusBadge kind={isQuote ? "quote" : "invoice"} status={status} size="sm" />
        </div>
        <p className="text-sm text-[#4B5563] truncate">{item.title}</p>
        <p className="text-xs text-[#9CA3AF] mt-0.5">
          {date} · {amount}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2 shrink-0">
        {showAccept ? (
          <PortalAcceptQuoteButton
            token={token}
            quote={item}
            lang={lang}
            t={t}
            onAccepted={onQuoteAccepted}
            className="h-9 text-sm"
          />
        ) : null}
        <button
          type="button"
          onClick={() => onView(type, item)}
          className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-[#E7E9EE] text-sm font-medium text-[#374151] hover:bg-[#FAFAFA]"
        >
          <Eye className="w-3.5 h-3.5" />
          {t("portal.view")}
        </button>
        <PortalPdfButton type={type} item={item} token={token} lang={lang} t={t} />
      </div>
    </div>
  );
}

function PortalPdfButton({ type, item, token, lang, t }) {
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      if (type === "quote") {
        await downloadPortalQuotePdf(token, item.id, { lang, number: item.number });
      } else {
        await downloadPortalInvoicePdf(token, item.id, { lang, number: item.number });
      }
    } catch (err) {
      toast.error(err.message || t("portal.pdfError"));
    } finally {
      setDownloading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleDownload}
      disabled={downloading}
      className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg bg-[#0A2540] text-sm font-medium text-white hover:bg-[#173A5E] disabled:opacity-60"
    >
      {downloading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
      {t("portal.downloadPdf")}
    </button>
  );
}

export default function PortalDocumentSection({
  token,
  quotes,
  invoices,
  canAcceptQuotes,
  lang,
  t,
  onQuoteAccepted,
}) {
  const [viewing, setViewing] = useState(null);

  const handleQuoteAccepted = (updatedQuote) => {
    onQuoteAccepted?.(updatedQuote);
    setViewing((current) =>
      current?.type === "quote" && current.document?.id === updatedQuote.id
        ? { type: "quote", document: updatedQuote }
        : current
    );
  };

  const empty = !quotes.length && !invoices.length;

  return (
    <div className="space-y-6">
      {empty ? (
        <div className="rounded-xl border border-dashed border-[#E5E7EB] bg-[#FAFAFA] px-6 py-10 text-center">
          <p className="text-sm text-[#6B7280]">{t("portal.empty")}</p>
        </div>
      ) : null}

      {quotes.length > 0 ? (
        <section>
          <h2 className="font-cabinet text-lg font-bold text-[#111827] mb-3">{t("portal.quotes")}</h2>
          <div className="space-y-2">
            {quotes.map((item) => (
              <DocumentRow
                key={item.id}
                type="quote"
                item={item}
                lang={lang}
                t={t}
                token={token}
                canAcceptQuotes={canAcceptQuotes}
                onView={(type, doc) => setViewing({ type, document: doc })}
                onQuoteAccepted={handleQuoteAccepted}
              />
            ))}
          </div>
        </section>
      ) : null}

      {invoices.length > 0 ? (
        <section>
          <h2 className="font-cabinet text-lg font-bold text-[#111827] mb-3">{t("portal.invoices")}</h2>
          <div className="space-y-2">
            {invoices.map((item) => (
              <DocumentRow
                key={item.id}
                type="invoice"
                item={item}
                lang={lang}
                t={t}
                token={token}
                canAcceptQuotes={false}
                onView={(type, doc) => setViewing({ type, document: doc })}
              />
            ))}
          </div>
        </section>
      ) : null}

      <PortalDocumentDetailModal
        token={token}
        type={viewing?.type}
        document={viewing?.document}
        open={Boolean(viewing)}
        onOpenChange={(open) => !open && setViewing(null)}
        canAcceptQuotes={canAcceptQuotes}
        lang={lang}
        t={t}
        onQuoteAccepted={handleQuoteAccepted}
      />
    </div>
  );
}
