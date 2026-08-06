import { useNavigate } from "react-router-dom";
import { Phone, Plus, Upload, BookOpen } from "lucide-react";
import { ActionButton } from "@/components/dashboard/ActionButton";

const cardBase =
  "flex flex-col h-full min-h-[320px] rounded-2xl bg-dash-surface p-6 shadow-[0_1px_2px_rgba(17,24,39,0.04),0_4px_16px_rgba(17,24,39,0.04)] ring-1 ring-[#E5E7EB]/80";

function formatDate(value, language) {
  if (!value) return null;
  try {
    return new Intl.DateTimeFormat(language === "en" ? "en-GB" : "fr-FR", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

export default function PhoneIntegrationCard({ status, t, lang, Logo }) {
  const navigate = useNavigate();
  const lastCall = status?.lastCall;
  const lastCallLabel = formatDate(lastCall?.startedAt, lang);
  const stats = status?.stats || {};
  const comingSoon = status?.comingSoonVendors || ["twilio", "aircall", "ringover", "ovh"];

  return (
    <article className={cardBase} data-testid="phone-card">
      <div className="flex items-start gap-4 mb-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-dash-bg ring-1 ring-[#E5E7EB]/60">
          {Logo ? <Logo className="w-7 h-7" /> : <Phone className="w-6 h-6 text-dash-primary" />}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-cabinet text-base font-semibold text-dash-text tracking-tight">
            {t("integrations.phone.title")}
          </h3>
          <p className="mt-1 text-sm text-dash-text-muted line-clamp-2 leading-relaxed">
            {t("integrations.phone.desc")}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-3">
        <span
          className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium bg-sky-50 text-sky-800"
          data-testid="phone-status"
        >
          {t("integrations.phone.modeManual")}
        </span>
      </div>

      <div className="space-y-1.5 mb-4 text-xs text-dash-text-subtle">
        <p data-testid="phone-last-call">
          {t("integrations.phone.lastCall")}:{" "}
          {lastCallLabel
            ? `${lastCallLabel}${lastCall?.phoneNumber ? ` · ${lastCall.phoneNumber}` : ""}`
            : "—"}
        </p>
      </div>

      {(stats.total || 0) > 0 ? (
        <dl className="grid grid-cols-2 gap-2 mb-4 text-sm" data-testid="phone-summary">
          {[
            ["total", stats.total],
            ["missed", stats.missed],
            ["linked", stats.linked],
            ["unmatched", stats.unmatched],
          ].map(([key, value]) => (
            <div key={key} className="rounded-lg bg-dash-bg px-3 py-2">
              <dt className="text-[11px] text-dash-text-subtle">
                {t(`integrations.phone.summary.${key}`)}
              </dt>
              <dd className="font-semibold text-dash-text tabular-nums" data-testid={`phone-summary-${key}`}>
                {value ?? 0}
              </dd>
            </div>
          ))}
        </dl>
      ) : (
        <div className="flex-1 mb-4" />
      )}

      <div className="mt-auto space-y-3">
        <div className="flex flex-wrap gap-2">
          <ActionButton
            variant="primary"
            onClick={() => navigate("/dashboard/calls")}
            data-testid="phone-open-journal"
            className="gap-1.5"
          >
            <BookOpen className="w-4 h-4" />
            {t("integrations.phone.openJournal")}
          </ActionButton>
          <ActionButton
            variant="secondary"
            onClick={() => navigate("/dashboard/calls?import=1")}
            data-testid="phone-import-csv"
            className="gap-1.5"
          >
            <Upload className="w-4 h-4" />
            {t("integrations.phone.importCsv")}
          </ActionButton>
          <ActionButton
            variant="secondary"
            onClick={() => navigate("/dashboard/calls?add=1")}
            data-testid="phone-add-call"
            className="gap-1.5"
          >
            <Plus className="w-4 h-4" />
            {t("integrations.phone.addCall")}
          </ActionButton>
        </div>

        <p className="text-[11px] text-dash-text-subtle" data-testid="phone-coming-soon">
          {t("integrations.phone.carriersSoon")}:{" "}
          {comingSoon
            .map((v) => v.charAt(0).toUpperCase() + v.slice(1))
            .slice(0, 4)
            .join(", ")}
        </p>
      </div>
    </article>
  );
}
