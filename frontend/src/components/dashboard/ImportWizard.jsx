import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  FileText,
  Loader2,
  Sparkles,
  Upload,
  UserCheck,
  UserPlus,
  Wand2,
} from "lucide-react";
import { useDashboardLang } from "@/hooks/useDashboardLang";
import ImportSuccessPanel from "@/components/dashboard/ImportSuccessPanel";
import { analyzeImport, confirmImport } from "@/lib/importApi";
import {
  ANALYSIS_STAGE_KEYS,
  buildConfirmPayload,
  computeAmountTtc,
  CONFIDENCE_LEVELS,
  CONFIRMABLE_KINDS,
  DOCUMENT_KINDS,
  getClientMatchLevel,
  getConfidenceLevel,
  getDetectedLineItems,
  getDetectedSummaryFields,
  getFieldConfidenceScore,
  getFieldDisplayValue,
  formatLineItemAmount,
  formatLineItemQuantity,
  hasFieldValue,
  IMPORT_ACCEPT,
  sessionToFormState,
} from "@/utils/importDisplay";
import {
  centsToEurosInput,
  datetimeLocalToIso,
  eurosToCents,
  formatQuoteAmount,
  toDatetimeLocalValue,
} from "@/utils/quoteDisplay";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const MODAL_OVERLAY_CLASS = "z-[100] bg-[#0A0A0B]/50 backdrop-blur-md";
const MODAL_CONTENT_CLASS =
  "z-[100] w-[calc(100%-2rem)] max-w-2xl max-h-[90vh] overflow-y-auto bg-white border border-[#E7E9EE] rounded-[22px] p-6 sm:p-8 shadow-[0_1px_0_rgba(255,255,255,0.9)_inset,0_20px_60px_-15px_rgba(10,10,11,0.35)] sm:rounded-[22px] [&>button]:rounded-lg";
const FIELD_CLASS =
  "h-10 rounded-xl border border-[#E7E9EE] bg-white px-4 text-[15px] text-[#111827] shadow-none placeholder:text-[#8A8F98] focus-visible:border-[#0A2540] focus-visible:ring-2 focus-visible:ring-[#0A2540]/15";
const TEXTAREA_CLASS = `${FIELD_CLASS} min-h-[80px] py-3 h-auto`;
const LABEL_CLASS = "text-sm font-medium text-[#374151]";
const SELECT_CONTENT_CLASS = "z-[110] rounded-xl border border-[#E7E9EE] bg-white text-[#111827] shadow-lg";

const STEPS = [1, 2, 3, 4];
const SUCCESS_STEP = 5;
const SUMMARY_FIELDS = getDetectedSummaryFields();

function StepBadge({ active, done, label }) {
  return (
    <div
      className={[
        "w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 transition-colors",
        done ? "bg-[#ECFDF5] text-[#065F46]" : active ? "bg-[#0A2540] text-white" : "bg-[#F3F4F6] text-[#6B7280]",
      ].join(" ")}
    >
      {done ? <CheckCircle2 className="w-4 h-4" /> : label}
    </div>
  );
}

function ConfidenceBadge({ level, t }) {
  const config = CONFIDENCE_LEVELS[level] || CONFIDENCE_LEVELS.missing;
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${config.badgeClass}`}
    >
      {t(`importWizard.confidence.${config.key}`)}
    </span>
  );
}

function FieldLabel({ label, session, form, fieldKey, t }) {
  const score = getFieldConfidenceScore(session, fieldKey);
  const level = getConfidenceLevel(score, hasFieldValue(form, fieldKey));
  return (
    <div className="flex items-center justify-between gap-2">
      <Label className={LABEL_CLASS}>{label}</Label>
      <ConfidenceBadge level={level} t={t} />
    </div>
  );
}

function AnalyzingPanel({ progress, stageIndex, t }) {
  return (
    <div
      className="rounded-2xl border border-[#E7E9EE] bg-gradient-to-br from-[#F8FAFF] to-white p-6 sm:p-8"
      data-testid="import-wizard-analyzing"
    >
      <div className="flex items-start gap-4">
        <div className="relative w-12 h-12 rounded-2xl bg-[#0A2540] flex items-center justify-center shrink-0">
          <Sparkles className="w-5 h-5 text-white animate-pulse" />
          <span className="absolute -right-1 -top-1 w-3 h-3 rounded-full bg-[#0066FF] animate-ping" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-cabinet text-lg font-bold text-[#111827] tracking-tight">
            {t("importWizard.analyzingDocument")}
          </p>
          <p className="text-sm text-[#6B7280] mt-1">{t("importWizard.analyzingHint")}</p>
        </div>
      </div>

      <div className="mt-6">
        <div className="h-2 rounded-full bg-[#E5E7EB] overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-[#0066FF] to-[#0A2540] transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="mt-2 text-right text-xs font-medium text-[#0A2540]">{progress}%</div>
      </div>

      <div className="mt-5 space-y-2">
        {ANALYSIS_STAGE_KEYS.map((key, index) => {
          const done = index < stageIndex;
          const active = index === stageIndex;
          return (
            <div
              key={key}
              className={[
                "flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors",
                active ? "bg-[#EFF6FF] text-[#0A2540]" : done ? "text-[#065F46]" : "text-[#9CA3AF]",
              ].join(" ")}
            >
              {done ? (
                <CheckCircle2 className="w-4 h-4 shrink-0" />
              ) : active ? (
                <Loader2 className="w-4 h-4 shrink-0 animate-spin" />
              ) : (
                <span className="w-4 h-4 rounded-full border border-current shrink-0" />
              )}
              <span>{t(`importWizard.analysisStages.${key}`)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DetectedSummaryGrid({ session, form, t }) {
  const labels = {
    kind: t("importWizard.fields.kind"),
    client: t("importWizard.summary.client"),
    externalNumber: t("importWizard.fields.externalNumber"),
    documentDate: t("importWizard.fields.documentDate"),
    amountHT: t("importWizard.fields.amountHT"),
    vatRate: t("importWizard.fields.vatRate"),
    amountTTC: t("importWizard.fields.amountTTC"),
  };

  return (
    <div className="rounded-2xl border border-[#E7E9EE] bg-[#FAFAFA] p-4 sm:p-5">
      <div className="flex items-center gap-2 mb-4">
        <Wand2 className="w-4 h-4 text-[#0066FF]" />
        <h3 className="font-cabinet text-sm font-bold text-[#111827]">
          {t("importWizard.detectedResults")}
        </h3>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {SUMMARY_FIELDS.map((fieldKey) => {
          const score = getFieldConfidenceScore(session, fieldKey);
          const level = getConfidenceLevel(score, hasFieldValue(form, fieldKey));
          return (
            <div
              key={fieldKey}
              className="rounded-xl border border-[#E7E9EE] bg-white px-3 py-2.5"
            >
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="text-[10px] uppercase tracking-wide text-[#9CA3AF] font-semibold">
                  {labels[fieldKey]}
                </span>
                <ConfidenceBadge level={level} t={t} />
              </div>
              <div className="text-sm font-medium text-[#111827] truncate">
                {getFieldDisplayValue(form, fieldKey, t)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DetectedLineItemsPanel({ session, t }) {
  const lineItems = getDetectedLineItems(session);
  if (lineItems.length === 0) return null;

  const columns = [
    { key: "label", label: t("importWizard.lineItems.label") },
    { key: "quantity", label: t("importWizard.lineItems.quantity") },
    { key: "unitPriceHT", label: t("importWizard.lineItems.unitPriceHT") },
    { key: "amountHT", label: t("importWizard.lineItems.amountHT") },
    { key: "vatRate", label: t("importWizard.lineItems.vatRate") },
    { key: "discount", label: t("importWizard.lineItems.discount") },
  ];

  return (
    <div className="rounded-2xl border border-[#E7E9EE] bg-[#FAFAFA] p-4 sm:p-5">
      <div className="flex items-center gap-2 mb-4">
        <FileText className="w-4 h-4 text-[#0066FF]" />
        <h3 className="font-cabinet text-sm font-bold text-[#111827]">
          {t("importWizard.lineItems.title")}
        </h3>
        <span className="ml-auto text-xs text-[#6B7280]">
          {lineItems.length} {t("importWizard.lineItems.countLabel")}
        </span>
      </div>
      <div className="hidden sm:block overflow-x-auto rounded-xl border border-[#E7E9EE] bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-[#F9FAFB] text-[#6B7280]">
            <tr>
              {columns.map((column) => (
                <th key={column.key} className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wide">
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {lineItems.map((item, index) => (
              <tr key={`${item.label}-${index}`} className="border-t border-[#F3F4F6]">
                <td className="px-3 py-2.5 font-medium text-[#111827]">{item.label || item.description || "—"}</td>
                <td className="px-3 py-2.5 text-[#374151]">{formatLineItemQuantity(item.quantity)}</td>
                <td className="px-3 py-2.5 text-[#374151]">{formatLineItemAmount(item.unitPriceHT)}</td>
                <td className="px-3 py-2.5 text-[#374151]">{formatLineItemAmount(item.amountHT)}</td>
                <td className="px-3 py-2.5 text-[#374151]">
                  {item.vatRate != null ? `${item.vatRate} %` : "—"}
                </td>
                <td className="px-3 py-2.5 text-[#374151]">{item.discount || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="sm:hidden space-y-3">
        {lineItems.map((item, index) => (
          <div key={`${item.label}-${index}`} className="rounded-xl border border-[#E7E9EE] bg-white p-3">
            <div className="text-sm font-medium text-[#111827]">{item.label || item.description || "—"}</div>
            <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-[#6B7280]">
              <div>
                <span className="font-semibold">{t("importWizard.lineItems.quantity")}: </span>
                {formatLineItemQuantity(item.quantity)}
              </div>
              <div>
                <span className="font-semibold">{t("importWizard.lineItems.unitPriceHT")}: </span>
                {formatLineItemAmount(item.unitPriceHT)}
              </div>
              <div>
                <span className="font-semibold">{t("importWizard.lineItems.amountHT")}: </span>
                {formatLineItemAmount(item.amountHT)}
              </div>
              <div>
                <span className="font-semibold">{t("importWizard.lineItems.vatRate")}: </span>
                {item.vatRate != null ? `${item.vatRate} %` : "—"}
              </div>
              {item.discount ? (
                <div className="col-span-2">
                  <span className="font-semibold">{t("importWizard.lineItems.discount")}: </span>
                  {item.discount}
                </div>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ClientMatchCard({ match, selected, onSelect, onUse, t }) {
  const level = getClientMatchLevel(match.score);
  return (
    <div
      className={[
        "rounded-2xl border p-4 transition-all",
        selected ? "border-[#0A2540] bg-[#EFF6FF] shadow-sm" : "border-[#E7E9EE] bg-white",
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <UserCheck className="w-4 h-4 text-[#0A2540] shrink-0" />
            <span className="font-medium text-[#111827]">{match.clientName}</span>
            <ConfidenceBadge level={level} t={t} />
          </div>
        </div>
      </div>
      <Button
        type="button"
        size="sm"
        className="mt-3 rounded-xl bg-[#0A2540] hover:bg-[#173A5E] w-full sm:w-auto"
        onClick={() => {
          onSelect(match.clientId);
          onUse();
        }}
      >
        {t("importWizard.useThisClient")}
      </Button>
    </div>
  );
}

function FinalSummaryPanel({ session, form, clientAction, selectedClientId, t, lang }) {
  const clientLabel =
    clientAction === "use_existing"
      ? session?.clientMatches?.find((m) => m.clientId === selectedClientId)?.clientName
      : form.clientName;

  const actionLabel =
    form.targetKind === "invoice"
      ? t("importWizard.finalActionInvoice")
      : t("importWizard.finalActionQuote");

  return (
    <div className="rounded-2xl border border-[#E7E9EE] overflow-hidden">
      <div className="bg-gradient-to-r from-[#0A2540] to-[#173A5E] px-5 py-4 text-white">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4" />
          <span className="font-cabinet font-bold">{t("importWizard.readyTitle")}</span>
        </div>
        <p className="text-sm text-white/80 mt-1">{t("importWizard.readySubtitle")}</p>
      </div>

      <div className="p-5 space-y-4 bg-white">
        <div className="flex items-start gap-3 pb-4 border-b border-[#F3F4F6]">
          <div className="w-10 h-10 rounded-xl bg-[#F3F4F6] flex items-center justify-center shrink-0">
            <FileText className="w-5 h-5 text-[#4B5563]" />
          </div>
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-wide text-[#9CA3AF] font-semibold">
              {t("importWizard.originalDocument")}
            </div>
            <div className="text-sm font-medium text-[#111827] truncate">{session?.file?.name}</div>
          </div>
        </div>

        {[
          [t("importWizard.fields.kind"), t(`importWizard.kind.${form.targetKind}`)],
          [t("importWizard.summary.client"), clientLabel || "—"],
          [t("importWizard.fields.amountTTC"), formatQuoteAmount(form.amountTTC, lang)],
          [t("importWizard.finalAction"), actionLabel],
        ].map(([label, value]) => (
          <div key={label} className="flex items-start justify-between gap-4 text-sm">
            <span className="text-[#6B7280] shrink-0">{label}</span>
            <span className="font-medium text-[#111827] text-right">{value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ImportWizard({
  open,
  onOpenChange,
  defaultKind = null,
  onSuccess,
}) {
  const { t, lang } = useDashboardLang();
  const navigate = useNavigate();
  const inputRef = useRef(null);

  const [step, setStep] = useState(1);
  const [session, setSession] = useState(null);
  const [form, setForm] = useState({});
  const [clientAction, setClientAction] = useState("use_existing");
  const [selectedClientId, setSelectedClientId] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [analysisStageIndex, setAnalysisStageIndex] = useState(0);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [createdSummary, setCreatedSummary] = useState(null);

  const reset = useCallback(() => {
    setStep(1);
    setSession(null);
    setForm({});
    setClientAction("use_existing");
    setSelectedClientId("");
    setAnalyzing(false);
    setAnalysisProgress(0);
    setAnalysisStageIndex(0);
    setConfirming(false);
    setError(null);
    setDragging(false);
    setCreatedSummary(null);
  }, []);

  useEffect(() => {
    if (!open) reset();
  }, [open, reset]);

  useEffect(() => {
    if (!analyzing) return undefined;

    const progressTimer = window.setInterval(() => {
      setAnalysisProgress((value) => (value >= 92 ? value : value + 4));
    }, 350);

    const stageTimer = window.setInterval(() => {
      setAnalysisStageIndex((value) =>
        value >= ANALYSIS_STAGE_KEYS.length - 1 ? value : value + 1
      );
    }, 700);

    return () => {
      window.clearInterval(progressTimer);
      window.clearInterval(stageTimer);
    };
  }, [analyzing]);

  const updateForm = (patch) => {
    setForm((prev) => {
      const next = { ...prev, ...patch };
      if ("amountHT" in patch || "vatRate" in patch) {
        next.amountTTC = computeAmountTtc(next.amountHT, next.vatRate);
      }
      return next;
    });
  };

  const applySession = useCallback(
    (nextSession) => {
      const nextForm = sessionToFormState(nextSession, defaultKind);
      setSession(nextSession);
      setForm(nextForm);
      setClientAction(nextSession.clientMatches?.length ? "use_existing" : "create_new");
      setSelectedClientId(nextSession.clientMatches?.[0]?.clientId || "");
      setAnalysisProgress(100);
      setAnalysisStageIndex(ANALYSIS_STAGE_KEYS.length - 1);
      window.setTimeout(() => {
        setAnalyzing(false);
        setStep(2);
      }, 450);
    },
    [defaultKind]
  );

  const handleAnalyze = async (file) => {
    if (!file || analyzing) return;
    setAnalyzing(true);
    setAnalysisProgress(8);
    setAnalysisStageIndex(0);
    setError(null);
    try {
      const result = await analyzeImport(file);
      applySession(result);
    } catch (err) {
      setAnalyzing(false);
      setAnalysisProgress(0);
      setAnalysisStageIndex(0);
      setError(err.message || t("importWizard.errors.analyze"));
    } finally {
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const kindSupported = CONFIRMABLE_KINDS.has(form.targetKind);

  const canGoNext = useMemo(() => {
    if (step === 2) {
      return kindSupported && form.amountHT > 0;
    }
    if (step === 3) {
      if (clientAction === "use_existing") return Boolean(selectedClientId);
      return Boolean(form.clientName?.trim());
    }
    return true;
  }, [step, kindSupported, form.amountHT, form.clientName, clientAction, selectedClientId]);

  const handleConfirm = async () => {
    if (!session?.id || confirming) return;
    setConfirming(true);
    setError(null);
    try {
      const payload = buildConfirmPayload(
        {
          ...form,
          documentDate: datetimeLocalToIso(toDatetimeLocalValue(form.documentDate)) || form.documentDate,
        },
        clientAction,
        selectedClientId,
        {
          name: form.clientName,
          company: form.company,
          contactName: form.contactName,
          email: form.email,
          phone: form.phone,
          address: form.address,
          city: form.city,
        }
      );
      const result = await confirmImport(session.id, payload);
      onSuccess?.(result);
      const clientLabel =
        clientAction === "use_existing"
          ? session.clientMatches?.find((m) => m.clientId === selectedClientId)?.clientName
          : form.clientName || form.company;
      setCreatedSummary({
        entityType: result.created?.entityType || form.targetKind,
        entityId: result.created?.entityId || result.created?.quoteId || result.created?.invoiceId,
        number: result.created?.entityNumber || form.externalNumber,
        clientName: clientLabel,
        amountTTC: form.amountTTC,
        documentDate: form.documentDate,
      });
      setStep(SUCCESS_STEP);
    } catch (err) {
      setError(err.message || t("importWizard.errors.confirm"));
    } finally {
      setConfirming(false);
    }
  };

  const stepLabels = [
    t("importWizard.steps.upload"),
    t("importWizard.steps.review"),
    t("importWizard.steps.client"),
    t("importWizard.steps.confirm"),
  ];

  const handleViewDocument = () => {
    if (!createdSummary?.entityId) return;
    onOpenChange(false);
    const base =
      createdSummary.entityType === "invoice" ? "/dashboard/invoices" : "/dashboard/quotes";
    navigate(`${base}?open=${createdSummary.entityId}`);
  };

  const handleImportAnother = () => {
    reset();
  };

  const onSuccessStep = step === SUCCESS_STEP;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        overlayClassName={MODAL_OVERLAY_CLASS}
        className={MODAL_CONTENT_CLASS}
        data-testid="import-wizard"
      >
        <DialogHeader>
          <DialogTitle className="font-cabinet text-xl font-bold tracking-[-0.02em] text-[#111827] flex items-center gap-2">
            {!onSuccessStep ? <Sparkles className="w-5 h-5 text-[#0066FF]" /> : null}
            {onSuccessStep ? t("importWizard.successTitle") : t("importWizard.title")}
          </DialogTitle>
          {!onSuccessStep ? (
            <DialogDescription className="text-[#4B5563]">
              {t("importWizard.subtitle")}
            </DialogDescription>
          ) : null}
        </DialogHeader>

        {!onSuccessStep ? (
          <>
            <div className="flex items-center justify-between gap-2 py-2">
              {STEPS.map((n) => (
                <StepBadge key={n} label={n} active={step === n} done={step > n} />
              ))}
            </div>
            <div className="grid grid-cols-4 gap-1 text-[10px] text-[#6B7280] uppercase tracking-wide mb-4">
              {stepLabels.map((label) => (
                <span key={label} className="truncate">
                  {label}
                </span>
              ))}
            </div>
          </>
        ) : null}

        {error && (
          <div className="rounded-xl border border-[#FECACA] bg-[#FEF2F2] px-4 py-3 text-sm text-[#991B1B]">
            {error}
          </div>
        )}

        {step === 1 && analyzing && (
          <AnalyzingPanel progress={analysisProgress} stageIndex={analysisStageIndex} t={t} />
        )}

        {step === 1 && !analyzing && (
          <div
            className={[
              "border-2 border-dashed rounded-2xl p-8 text-center transition-colors",
              dragging ? "border-[#0A2540] bg-[#EFF6FF]/40" : "border-[#E5E7EB] bg-[#FAFAFA]",
              "cursor-pointer",
            ].join(" ")}
            onDrop={(event) => {
              event.preventDefault();
              setDragging(false);
              handleAnalyze(event.dataTransfer.files?.[0]);
            }}
            onDragOver={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onClick={() => inputRef.current?.click()}
            data-testid="import-wizard-dropzone"
          >
            <input
              ref={inputRef}
              type="file"
              accept={IMPORT_ACCEPT}
              className="hidden"
              onChange={(event) => handleAnalyze(event.target.files?.[0])}
            />
            <div className="w-12 h-12 rounded-xl bg-[#EFF6FF] text-[#0A2540] flex items-center justify-center mx-auto mb-4">
              <Upload className="w-5 h-5" />
            </div>
            <p className="text-sm font-medium text-[#111827]">{t("importWizard.dropHint")}</p>
            <p className="text-xs text-[#6B7280] mt-1">{t("importWizard.fileTypes")}</p>
          </div>
        )}

        {step === 2 && session && (
          <div className="space-y-5">
            <DetectedSummaryGrid session={session} form={form} t={t} />
            <DetectedLineItemsPanel session={session} t={t} />

            {session.duplicateWarning && (
              <div className="rounded-xl border border-[#FDE68A] bg-[#FFFBEB] px-4 py-3 text-sm text-[#92400E]">
                {session.duplicateWarning}
              </div>
            )}

            <div>
              <h3 className="font-cabinet text-sm font-bold text-[#111827] mb-3">
                {t("importWizard.editDetected")}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2 sm:col-span-2">
                  <FieldLabel
                    label={t("importWizard.fields.kind")}
                    session={session}
                    form={form}
                    fieldKey="kind"
                    t={t}
                  />
                  <Select value={form.targetKind} onValueChange={(value) => updateForm({ targetKind: value })}>
                    <SelectTrigger className={FIELD_CLASS}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className={SELECT_CONTENT_CLASS}>
                      {DOCUMENT_KINDS.map((kind) => (
                        <SelectItem key={kind} value={kind} disabled={!CONFIRMABLE_KINDS.has(kind)}>
                          {t(`importWizard.kind.${kind}`)}
                          {!CONFIRMABLE_KINDS.has(kind) ? ` (${t("importWizard.comingSoon")})` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2 sm:col-span-2">
                  <Label className={LABEL_CLASS}>{t("importWizard.fields.title")}</Label>
                  <Input className={FIELD_CLASS} value={form.title} onChange={(e) => updateForm({ title: e.target.value })} />
                </div>

                <div className="space-y-2">
                  <FieldLabel
                    label={t("importWizard.fields.externalNumber")}
                    session={session}
                    form={form}
                    fieldKey="externalNumber"
                    t={t}
                  />
                  <Input
                    className={FIELD_CLASS}
                    value={form.externalNumber}
                    onChange={(e) => updateForm({ externalNumber: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <FieldLabel
                    label={t("importWizard.fields.documentDate")}
                    session={session}
                    form={form}
                    fieldKey="documentDate"
                    t={t}
                  />
                  <Input
                    type="datetime-local"
                    className={FIELD_CLASS}
                    value={toDatetimeLocalValue(form.documentDate)}
                    onChange={(e) =>
                      updateForm({ documentDate: datetimeLocalToIso(e.target.value) || e.target.value })
                    }
                  />
                </div>

                <div className="space-y-2">
                  <FieldLabel
                    label={t("importWizard.fields.amountHT")}
                    session={session}
                    form={form}
                    fieldKey="amountHT"
                    t={t}
                  />
                  <Input
                    className={FIELD_CLASS}
                    value={centsToEurosInput(form.amountHT)}
                    onChange={(e) => updateForm({ amountHT: eurosToCents(e.target.value) })}
                  />
                </div>

                <div className="space-y-2">
                  <FieldLabel
                    label={t("importWizard.fields.vatRate")}
                    session={session}
                    form={form}
                    fieldKey="vatRate"
                    t={t}
                  />
                  <Input
                    className={FIELD_CLASS}
                    value={String(form.vatRate ?? 20)}
                    onChange={(e) => updateForm({ vatRate: Number(e.target.value) || 0 })}
                  />
                </div>

                <div className="space-y-2">
                  <FieldLabel
                    label={t("importWizard.fields.amountTTC")}
                    session={session}
                    form={form}
                    fieldKey="amountTTC"
                    t={t}
                  />
                  <Input className={FIELD_CLASS} readOnly value={centsToEurosInput(form.amountTTC)} />
                </div>

                <div className="space-y-2 sm:col-span-2">
                  <Label className={LABEL_CLASS}>{t("importWizard.fields.notes")}</Label>
                  <Textarea
                    className={TEXTAREA_CLASS}
                    value={form.internalNotes}
                    onChange={(e) => updateForm({ internalNotes: e.target.value })}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            {session?.clientMatches?.length > 0 ? (
              <div className="rounded-xl border border-[#BFDBFE] bg-[#EFF6FF] px-4 py-3 text-sm text-[#0A2540]">
                {t("importWizard.clientFound")}
              </div>
            ) : (
              <div className="rounded-xl border border-[#E7E9EE] bg-[#FAFAFA] px-4 py-3 text-sm text-[#4B5563]">
                {t("importWizard.noClientFound")}
              </div>
            )}

            {session?.clientMatches?.length > 0 && (
              <div className="space-y-3">
                {session.clientMatches.map((match) => (
                  <ClientMatchCard
                    key={match.clientId}
                    match={match}
                    selected={selectedClientId === match.clientId && clientAction === "use_existing"}
                    onSelect={setSelectedClientId}
                    onUse={() => setClientAction("use_existing")}
                    t={t}
                  />
                ))}
              </div>
            )}

            <button
              type="button"
              onClick={() => setClientAction("create_new")}
              className={[
                "w-full rounded-2xl border p-4 text-left transition-all",
                clientAction === "create_new"
                  ? "border-[#0A2540] bg-[#EFF6FF]"
                  : "border-[#E7E9EE] bg-white hover:bg-[#FAFAFA]",
              ].join(" ")}
            >
              <div className="flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-[#0A2540]" />
                <span className="font-medium text-[#111827]">{t("importWizard.createClient")}</span>
              </div>
              <p className="text-xs text-[#6B7280] mt-1">{t("importWizard.createClientHint")}</p>
            </button>

            {clientAction === "create_new" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                <div className="space-y-2 sm:col-span-2">
                  <FieldLabel
                    label={t("importWizard.fields.clientName")}
                    session={session}
                    form={form}
                    fieldKey="client"
                    t={t}
                  />
                  <Input
                    className={FIELD_CLASS}
                    value={form.clientName}
                    onChange={(e) => updateForm({ clientName: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label className={LABEL_CLASS}>{t("importWizard.fields.company")}</Label>
                  <Input className={FIELD_CLASS} value={form.company} onChange={(e) => updateForm({ company: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label className={LABEL_CLASS}>{t("importWizard.fields.email")}</Label>
                  <Input className={FIELD_CLASS} value={form.email} onChange={(e) => updateForm({ email: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label className={LABEL_CLASS}>{t("importWizard.fields.phone")}</Label>
                  <Input className={FIELD_CLASS} value={form.phone} onChange={(e) => updateForm({ phone: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label className={LABEL_CLASS}>{t("importWizard.fields.city")}</Label>
                  <Input className={FIELD_CLASS} value={form.city} onChange={(e) => updateForm({ city: e.target.value })} />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label className={LABEL_CLASS}>{t("importWizard.fields.address")}</Label>
                  <Input className={FIELD_CLASS} value={form.address} onChange={(e) => updateForm({ address: e.target.value })} />
                </div>
              </div>
            )}
          </div>
        )}

        {step === 4 && (
          <FinalSummaryPanel
            session={session}
            form={form}
            clientAction={clientAction}
            selectedClientId={selectedClientId}
            t={t}
            lang={lang}
          />
        )}

        {onSuccessStep && createdSummary ? (
          <ImportSuccessPanel
            summary={createdSummary}
            onView={handleViewDocument}
            onImportAnother={handleImportAnother}
          />
        ) : null}

        {!onSuccessStep ? (
        <DialogFooter className="gap-2 sm:gap-0 pt-2">
          {step > 1 && step < 4 && (
            <Button type="button" variant="outline" className="rounded-xl" onClick={() => setStep((s) => s - 1)}>
              <ArrowLeft className="w-4 h-4 mr-1" />
              {t("importWizard.back")}
            </Button>
          )}
          {step > 1 && step < 4 && (
            <Button
              type="button"
              className="rounded-xl bg-[#0A2540] hover:bg-[#173A5E]"
              disabled={!canGoNext}
              onClick={() => setStep((s) => s + 1)}
            >
              {t("importWizard.next")}
              <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          )}
          {step === 4 && (
            <Button
              type="button"
              className="rounded-xl bg-[#0A2540] hover:bg-[#173A5E] min-w-[180px]"
              disabled={confirming}
              onClick={handleConfirm}
              data-testid="import-wizard-confirm"
            >
              {confirming ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {t("importWizard.confirming")}
                </>
              ) : (
                t("importWizard.confirm")
              )}
            </Button>
          )}
        </DialogFooter>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
