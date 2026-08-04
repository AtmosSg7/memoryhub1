import { useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  FileText,
  Sparkles,
  UserCheck,
  UserPlus,
} from "lucide-react";
import { formatQuoteAmount } from "@/utils/quoteDisplay";
import {
  CONFIRMABLE_KINDS,
  DOCUMENT_KINDS,
  formatLineItemAmount,
  formatLineItemQuantity,
  getDetectedLineItems,
  getOverallConfidencePercent,
  getResolvedClientLabel,
  getVerificationWarnings,
  willCreateNewClient,
} from "@/utils/importDisplay";
import ClientFilterSelect from "@/components/dashboard/ClientFilterSelect";
import {
  FORM_FIELD_CLASS,
  FORM_LABEL_CLASS,
  FORM_SELECT_CONTENT_CLASS,
  FORM_TEXTAREA_CLASS,
} from "@/components/dashboard/detailModalLayout";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

function CheckItem({ children, variant = "success" }) {
  const Icon = variant === "warning" ? AlertTriangle : CheckCircle2;
  const iconClass =
    variant === "warning" ? "text-[#D97706]" : "text-[#059669]";
  return (
    <li className="flex items-start gap-2.5 text-sm text-dash-text">
      <Icon className={`w-4 h-4 shrink-0 mt-0.5 ${iconClass}`} />
      <span>{children}</span>
    </li>
  );
}

export function AssistantSummaryPanel({ session, form, t, lang }) {
  const lineItems = getDetectedLineItems(session);
  const confidence = getOverallConfidencePercent(session);
  const clientLabel = form.company?.trim() || form.clientName?.trim();
  const isInvoice = form.targetKind === "invoice";

  return (
    <div
      className="rounded-2xl border border-[#BFDBFE] bg-gradient-to-br from-dash-accent-soft to-white p-5 sm:p-6"
      data-testid="import-assistant-summary"
    >
      <div className="flex items-center gap-2 mb-4">
        <div className="w-9 h-9 rounded-xl bg-[var(--dash-nav-active-bg)] flex items-center justify-center">
          <Sparkles className="w-4 h-4 text-white" />
        </div>
        <div>
          <h3 className="font-cabinet text-base font-bold text-dash-primary">
            {t("importWizard.assistant.title")}
          </h3>
          <p className="text-xs text-dash-text-muted">{t("importWizard.assistant.subtitle")}</p>
        </div>
      </div>

      <ul className="space-y-2.5">
        <CheckItem>
          {isInvoice
            ? t("importWizard.assistant.recognizedInvoice")
            : t("importWizard.assistant.recognizedQuote")}
        </CheckItem>
        {clientLabel ? (
          <CheckItem>
            {t("importWizard.assistant.clientDetected").replace("{name}", clientLabel)}
          </CheckItem>
        ) : null}
        {lineItems.length > 0 ? (
          <CheckItem>
            {t("importWizard.assistant.linesDetected").replace("{count}", String(lineItems.length))}
          </CheckItem>
        ) : null}
        {form.amountTTC > 0 ? (
          <CheckItem>
            {t("importWizard.assistant.totalTtc").replace(
              "{amount}",
              formatQuoteAmount(form.amountTTC, lang)
            )}
          </CheckItem>
        ) : null}
        {confidence != null ? (
          <CheckItem>
            {t("importWizard.assistant.confidence").replace("{percent}", String(confidence))}
          </CheckItem>
        ) : null}
      </ul>
    </div>
  );
}

export function VerificationWarningsPanel({ session, form, t }) {
  const warnings = getVerificationWarnings(session, form, t);
  if (warnings.length === 0) return null;

  return (
    <div
      className="rounded-2xl border border-[#FDE68A] bg-[#FFFBEB] p-4 sm:p-5"
      data-testid="import-verification-warnings"
    >
      <div className="flex items-center gap-2 mb-3">
        <AlertTriangle className="w-4 h-4 text-[#D97706]" />
        <h3 className="font-cabinet text-sm font-bold text-[#92400E]">
          {t("importWizard.warnings.title")}
        </h3>
      </div>
      <ul className="space-y-2">
        {warnings.map((warning) => (
          <li key={warning.field} className="flex items-start gap-2 text-sm text-[#92400E]">
            <span className="shrink-0">⚠</span>
            <span>{warning.message}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function LineItemsCards({ session, t }) {
  const lineItems = getDetectedLineItems(session);
  if (lineItems.length === 0) return null;

  return (
    <div className="rounded-2xl border border-dash-border bg-dash-surface-muted p-4 sm:p-5">
      <div className="flex items-center gap-2 mb-4">
        <FileText className="w-4 h-4 text-[#0066FF]" />
        <h3 className="font-cabinet text-sm font-bold text-dash-text">
          {t("importWizard.lineItems.title")}
        </h3>
        <span className="ml-auto text-xs font-medium text-dash-text-muted bg-dash-surface border border-dash-border rounded-full px-2 py-0.5">
          {lineItems.length}
        </span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {lineItems.map((item, index) => (
          <div
            key={`${item.label}-${index}`}
            className="rounded-xl border border-dash-border bg-dash-surface p-3.5"
          >
            <p className="text-sm font-medium text-dash-text leading-snug">
              {item.label || item.description || "—"}
            </p>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-dash-text-muted">
              <span>
                {t("importWizard.lineItems.quantity")}: {formatLineItemQuantity(item.quantity)}
              </span>
              <span>
                {formatLineItemAmount(item.amountHT)}
                {item.vatRate != null ? ` · TVA ${item.vatRate}%` : ""}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ClientAttachmentBanner({
  session,
  form,
  clientAction,
  selectedClientId,
  t,
}) {
  const clientName = getResolvedClientLabel(session, form, clientAction, selectedClientId);
  const creatingNew = willCreateNewClient(session, clientAction) || clientAction === "create_new";

  return (
    <div
      className={[
        "rounded-2xl border px-4 py-3.5 flex items-start gap-3",
        creatingNew
          ? "border-dash-border bg-dash-surface-muted"
          : "border-[#BFDBFE] bg-dash-accent-soft",
      ].join(" ")}
      data-testid="import-client-attachment"
    >
      {creatingNew ? (
        <UserPlus className="w-5 h-5 text-dash-text-muted shrink-0 mt-0.5" />
      ) : (
        <UserCheck className="w-5 h-5 text-dash-primary shrink-0 mt-0.5" />
      )}
      <div>
        <p className="text-sm font-medium text-dash-text">
          {creatingNew
            ? t("importWizard.assistant.newClientWillBeCreated")
            : t("importWizard.assistant.willAttachToClient").replace(
                "{name}",
                clientName || t("importWizard.summary.client")
              )}
        </p>
        {!creatingNew && clientName ? (
          <p className="text-xs text-dash-text-muted mt-1">{clientName}</p>
        ) : null}
      </div>
    </div>
  );
}

export function AdjustFieldsPanel({ session, form, updateForm, t, defaultVatRate = 20 }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-2xl border border-dash-border bg-dash-surface overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 text-sm font-medium text-dash-text-muted hover:bg-dash-surface-muted transition-colors"
        data-testid="import-adjust-toggle"
      >
        <span>{t("importWizard.editDetected")}</span>
        {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>
      {open ? (
        <div className="px-4 pb-4 pt-1 grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-dash-border-soft">
          <div className="space-y-2 sm:col-span-2">
            <Label className={FORM_LABEL_CLASS}>{t("importWizard.fields.kind")}</Label>
            <Select value={form.targetKind} onValueChange={(value) => updateForm({ targetKind: value })}>
              <SelectTrigger className={FORM_FIELD_CLASS}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className={FORM_SELECT_CONTENT_CLASS}>
                {DOCUMENT_KINDS.map((kind) => (
                  <SelectItem key={kind} value={kind} disabled={!CONFIRMABLE_KINDS.has(kind)}>
                    {t(`importWizard.kind.${kind}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label className={FORM_LABEL_CLASS}>{t("importWizard.fields.title")}</Label>
            <Input
              className={FORM_FIELD_CLASS}
              value={form.title}
              onChange={(e) => updateForm({ title: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label className={FORM_LABEL_CLASS}>{t("importWizard.fields.externalNumber")}</Label>
            <Input
              className={FORM_FIELD_CLASS}
              value={form.externalNumber}
              onChange={(e) => updateForm({ externalNumber: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label className={FORM_LABEL_CLASS}>{t("importWizard.fields.documentDate")}</Label>
            <Input
              type="date"
              className={FORM_FIELD_CLASS}
              value={form.documentDate ? form.documentDate.slice(0, 10) : ""}
              onChange={(e) => updateForm({ documentDate: e.target.value ? `${e.target.value}T12:00:00.000Z` : "" })}
            />
          </div>
          <div className="space-y-2">
            <Label className={FORM_LABEL_CLASS}>{t("importWizard.fields.amountHT")}</Label>
            <Input
              className={FORM_FIELD_CLASS}
              value={form.amountHT ? (form.amountHT / 100).toFixed(2) : ""}
              onChange={(e) => {
                const cents = Math.round(parseFloat(e.target.value.replace(",", ".")) * 100) || 0;
                updateForm({ amountHT: cents });
              }}
            />
          </div>
          <div className="space-y-2">
            <Label className={FORM_LABEL_CLASS}>{t("importWizard.fields.vatRate")}</Label>
            <Input
              className={FORM_FIELD_CLASS}
              value={String(form.vatRate ?? defaultVatRate)}
              onChange={(e) => updateForm({ vatRate: Number(e.target.value) || 0 })}
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label className={FORM_LABEL_CLASS}>{t("importWizard.fields.notes")}</Label>
            <Textarea
              className={FORM_TEXTAREA_CLASS}
              value={form.internalNotes}
              onChange={(e) => updateForm({ internalNotes: e.target.value })}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}

const READY_ACTION_KEYS = [
  "createClient",
  "createDocument",
  "addLines",
  "updateHistory",
  "indexDocument",
  "aiSearchable",
];

export function PremiumReadyPanel({
  session,
  form,
  clientAction,
  selectedClientId,
  clients,
  clientsLoading,
  onClientActionChange,
  onSelectClient,
  updateForm,
  t,
  lang,
}) {
  const clientName = getResolvedClientLabel(session, form, clientAction, selectedClientId);
  const creatingNew = willCreateNewClient(session, clientAction) || clientAction === "create_new";
  const docLabel = t(`importWizard.kind.${form.targetKind}`);

  return (
    <div className="space-y-4" data-testid="import-premium-ready">
      <div className="rounded-2xl border border-dash-border overflow-hidden">
        <div className="bg-gradient-to-r from-[#0A2540] to-[#173A5E] px-5 py-5 text-white">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5" />
            <span className="font-cabinet text-lg font-bold">{t("importWizard.ready.documentReady")}</span>
          </div>
          <p className="text-sm text-white/80 mt-1">{session?.file?.name}</p>
        </div>

        <div className="p-5 bg-dash-surface space-y-4">
          <div>
            <p className="text-sm font-semibold text-dash-text mb-3">
              {t("importWizard.ready.operationsTitle")}
            </p>
            <ul className="space-y-2">
              {READY_ACTION_KEYS.map((key) => {
                const skipClient = key === "createClient" && !creatingNew;
                if (skipClient) return null;
                return (
                  <CheckItem key={key}>
                    {t(`importWizard.ready.actions.${key}`).replace("{type}", docLabel)}
                  </CheckItem>
                );
              })}
            </ul>
          </div>

          <div className="rounded-xl bg-dash-surface-muted border border-dash-border p-3 grid grid-cols-2 gap-3 text-sm">
            <div>
              <span className="text-dash-text-subtle text-xs uppercase tracking-wide">{t("importWizard.fields.kind")}</span>
              <p className="font-medium text-dash-text mt-0.5">{docLabel}</p>
            </div>
            <div>
              <span className="text-dash-text-subtle text-xs uppercase tracking-wide">{t("importWizard.fields.amountTTC")}</span>
              <p className="font-medium text-dash-text mt-0.5">{formatQuoteAmount(form.amountTTC, lang)}</p>
            </div>
            <div className="col-span-2">
              <span className="text-dash-text-subtle text-xs uppercase tracking-wide">{t("importWizard.summary.client")}</span>
              <p className="font-medium text-dash-text mt-0.5">{clientName || "—"}</p>
            </div>
          </div>
        </div>
      </div>

      <ClientAttachmentBanner
        session={session}
        form={form}
        clientAction={clientAction}
        selectedClientId={selectedClientId}
        t={t}
      />

      {(session?.clientMatches?.length > 0 || clients.length > 0) && (
        <div className="rounded-2xl border border-dash-border bg-dash-surface p-4 space-y-3">
          <p className="text-sm font-medium text-dash-text">{t("importWizard.ready.changeClient")}</p>
          {session?.clientMatches?.length > 0 && (
            <div className="space-y-2">
              {session.clientMatches.slice(0, 2).map((match) => (
                <button
                  key={match.clientId}
                  type="button"
                  onClick={() => {
                    onSelectClient(match.clientId);
                    onClientActionChange("use_existing");
                  }}
                  className={[
                    "w-full text-left rounded-xl border px-3 py-2.5 text-sm transition-colors",
                    selectedClientId === match.clientId && clientAction === "use_existing"
                      ? "border-dash-primary bg-dash-accent-soft"
                      : "border-dash-border hover:bg-dash-surface-muted",
                  ].join(" ")}
                >
                  {match.clientName}
                </button>
              ))}
            </div>
          )}
          {clients.length > 0 && (
            <ClientFilterSelect
              clients={clients}
              value={clientAction === "use_existing" ? selectedClientId : ""}
              onChange={(clientId) => {
                if (!clientId) return;
                onClientActionChange("use_existing");
                onSelectClient(clientId);
              }}
              disabled={clientsLoading}
              testId="import-wizard-client-picker"
            />
          )}
          <button
            type="button"
            onClick={() => onClientActionChange("create_new")}
            className={[
              "w-full rounded-xl border px-3 py-2.5 text-sm text-left transition-colors",
              clientAction === "create_new"
                ? "border-dash-primary bg-dash-accent-soft"
                : "border-dash-border hover:bg-dash-surface-muted",
            ].join(" ")}
          >
            {t("importWizard.createClient")}
          </button>
        </div>
      )}

      {clientAction === "create_new" && (
        <div className="rounded-2xl border border-dash-border bg-dash-surface p-4">
          <Label className={FORM_LABEL_CLASS}>{t("importWizard.fields.clientName")}</Label>
          <Input
            className={`${FORM_FIELD_CLASS} mt-2`}
            value={form.clientName}
            onChange={(e) => updateForm?.({ clientName: e.target.value })}
          />
        </div>
      )}
    </div>
  );
}
