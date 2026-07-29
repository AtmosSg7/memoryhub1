import { useState } from "react";
import { AlertCircle, Download, Eye, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { toastApiError } from "@/utils/apiErrors";
import StatusBadge from "@/components/dashboard/StatusBadge";
import { ActionButton } from "@/components/dashboard/ActionButton";
import PortalQuoteActions from "@/components/portal/PortalQuoteActions";
import { formatQuoteAmount, formatQuoteDate } from "@/utils/quoteDisplay";
import {
  formatInvoiceAmount,
  formatInvoiceDate,
  getInvoiceDisplayStatus,
  getInvoicePaymentSummary,
} from "@/utils/invoiceDisplay";
import { downloadPortalInvoicePdf, downloadPortalQuotePdf } from "@/lib/portalPdfApi";
import PortalDocumentDetailModal from "@/components/portal/PortalDocumentDetailModal";

function PortalPendingBanner({ quotes, lang, t, onView }) {
  const pending = quotes.filter((quote) => quote.canAccept);
  if (pending.length === 0) return null;

  const first = pending[0];
  const description =
    pending.length === 1
      ? t("portal.pendingDesc")
          .replace("{number}", first.number)
          .replace("{amount}", formatQuoteAmount(first.amountTTC, lang))
      : t("portal.pendingDescPlural").replace("{count}", String(pending.length));

  return (
    <div
      className="rounded-2xl border border-[#BFDBFE] bg-gradient-to-br from-[#EFF6FF] to-[#F8FAFC] px-4 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shadow-[0_1px_2px_rgba(37,99,235,0.08)]"
      data-testid="portal-pending-banner"
    >
      <div className="flex items-start gap-3 min-w-0">
        <div className="w-9 h-9 rounded-xl bg-white border border-[#DBEAFE] flex items-center justify-center shrink-0 shadow-sm">
          <AlertCircle className="w-4 h-4 text-[#2563EB]" aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <p className="font-semibold text-sm text-[#1E3A8A]">{t("portal.pendingTitle")}</p>
          <p className="text-sm text-[#1D4ED8] mt-0.5 leading-relaxed">{description}</p>
        </div>
      </div>
      {pending.length === 1 ? (
        <ActionButton
          variant="primary"
          onClick={() => onView("quote", first)}
          className="shrink-0 w-full sm:w-auto"
        >
          {t("portal.pendingCta")}
        </ActionButton>
      ) : null}
    </div>
  );
}

function SectionHeading({ title, count }) {
  return (
    <div className="flex items-center gap-2.5 mb-3">
      <h2 className="font-cabinet text-lg font-bold text-[#111827]">{title}</h2>
      <span className="inline-flex items-center justify-center min-w-[1.375rem] h-5 px-1.5 rounded-full bg-[#F3F4F6] text-[11px] font-semibold text-[#6B7280] tabular-nums">
        {count}
      </span>
    </div>
  );
}

function DocumentRow({ type, item, lang, t, token, canAcceptQuotes, canRejectQuotes, onView, onQuoteAccepted }) {
  const isQuote = type === "quote";
  const date = isQuote
    ? formatQuoteDate(item.quoteDate, lang)
    : formatInvoiceDate(item.invoiceDate, lang);
  const amount = isQuote
    ? formatQuoteAmount(item.amountTTC, lang)
    : formatInvoiceAmount(item.amountTTC, lang);
  const status = isQuote ? item.status : getInvoiceDisplayStatus(item);
  const payment = !isQuote ? getInvoicePaymentSummary(item) : null;
  const showAmountDue = payment && payment.due > 0 && status !== "paid";
  const showActions = isQuote && (item.canAccept || item.canReject);
  const accentClass = item.canAccept
    ? "border-l-[3px] border-l-[#3B82F6]"
    : status === "accepted"
      ? "border-l-[3px] border-l-[#10B981]"
      : status === "rejected"
        ? "border-l-[3px] border-l-[#9CA3AF]"
        : status === "overdue"
          ? "border-l-[3px] border-l-[#EA580C]"
          : "border-l-[3px] border-l-transparent";

  return (
    <div
      className={[
        "group flex flex-col sm:flex-row sm:items-center gap-3 rounded-2xl border border-[#E5E7EB] bg-white px-4 py-3.5 shadow-[0_1px_2px_rgba(0,0,0,0.03)] transition-all duration-200 hover:border-[#D1D5DB] hover:shadow-[0_4px_12px_rgba(0,0,0,0.05)]",
        accentClass,
      ].join(" ")}
      data-testid={`portal-${type}-${item.id}`}
    >
      <button
        type="button"
        onClick={() => onView(type, item)}
        className="min-w-0 flex-1 text-left rounded-lg -m-1 p-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0A2540]/20"
      >
        <div className="flex flex-wrap items-center gap-2 mb-1">
          <span className="font-semibold text-sm text-[#111827] tabular-nums">{item.number}</span>
          <StatusBadge kind={isQuote ? "quote" : "invoice"} status={status} size="sm" />
        </div>
        <p className="text-sm text-[#4B5563] line-clamp-2 sm:truncate">{item.title}</p>
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 mt-1.5">
          <span className="text-xs text-[#6B7280]">{date}</span>
          <span className="text-sm font-semibold text-[#0A2540] tabular-nums">{amount}</span>
          {showAmountDue ? (
            <span className="text-xs text-[#C2410C] font-medium tabular-nums">
              · {t("portal.amountDue")} {formatInvoiceAmount(payment.due, lang)}
            </span>
          ) : null}
        </div>
      </button>
      <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2 shrink-0 w-full sm:w-auto pt-1 sm:pt-0 border-t border-[#F3F4F6] sm:border-0">
        {showActions ? (
          <PortalQuoteActions
            token={token}
            quote={item}
            lang={lang}
            t={t}
            canReject={canRejectQuotes}
            onUpdated={onQuoteAccepted}
            className="w-full sm:w-auto"
          />
        ) : null}
        <ActionButton
          variant="secondary"
          onClick={() => onView(type, item)}
          className="gap-1.5 h-9 text-sm w-full sm:w-auto"
        >
          <Eye className="w-3.5 h-3.5" />
          {t("portal.view")}
        </ActionButton>
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
      toast.success(t("portal.pdfSuccess"));
    } catch (err) {
      toastApiError(err, t, "portal.pdfError");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <ActionButton
      variant="quick"
      onClick={handleDownload}
      disabled={downloading}
      className="gap-1.5 h-9 text-sm w-full sm:w-auto"
    >
      {downloading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
      {t("portal.downloadPdf")}
    </ActionButton>
  );
}

function PortalDocumentsEmpty({ t }) {
  return (
    <div
      className="rounded-2xl border border-dashed border-[#E5E7EB] bg-white py-12 px-6 text-center"
      data-testid="portal-documents-empty"
    >
      <div className="w-12 h-12 rounded-2xl bg-[#F9FAFB] border border-[#E5E7EB] flex items-center justify-center mx-auto mb-4 text-[#9CA3AF]">
        <FileText className="w-5 h-5" strokeWidth={1.75} aria-hidden="true" />
      </div>
      <h3 className="font-cabinet text-[17px] font-semibold text-[#111827] tracking-tight">
        {t("portal.emptyTitle")}
      </h3>
      <p className="text-[13px] text-[#6B7280] mt-1.5 max-w-sm mx-auto leading-relaxed">
        {t("portal.empty")}
      </p>
    </div>
  );
}

export default function PortalDocumentSection({
  token,
  quotes,
  invoices,
  canAcceptQuotes,
  canRejectQuotes = true,
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
  const pendingQuotes = quotes.filter((quote) => quote.canAccept);

  return (
    <div className="space-y-6">
      {pendingQuotes.length > 0 ? (
        <PortalPendingBanner
          quotes={quotes}
          lang={lang}
          t={t}
          onView={(type, doc) => setViewing({ type, document: doc })}
        />
      ) : null}

      {empty ? <PortalDocumentsEmpty t={t} /> : null}

      {quotes.length > 0 ? (
        <section>
          <SectionHeading title={t("portal.quotes")} count={quotes.length} />
          <div className="space-y-2.5">
            {quotes.map((item) => (
              <DocumentRow
                key={item.id}
                type="quote"
                item={item}
                lang={lang}
                t={t}
                token={token}
                canAcceptQuotes={canAcceptQuotes}
                canRejectQuotes={canRejectQuotes}
                onView={(type, doc) => setViewing({ type, document: doc })}
                onQuoteAccepted={handleQuoteAccepted}
              />
            ))}
          </div>
        </section>
      ) : null}

      {invoices.length > 0 ? (
        <section>
          <SectionHeading title={t("portal.invoices")} count={invoices.length} />
          <div className="space-y-2.5">
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
        canRejectQuotes={canRejectQuotes}
        lang={lang}
        t={t}
        onQuoteAccepted={handleQuoteAccepted}
      />
    </div>
  );
}
