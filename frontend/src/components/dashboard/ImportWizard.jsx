import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { commercialDocumentsPath } from "@/utils/commercialDocumentsPath";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  FileText,
  Loader2,
  Sparkles,
  Upload,
  Wand2,
} from "lucide-react";
import { useDashboardLang } from "@/hooks/useDashboardLang";
import { useClients } from "@/hooks/useClients";
import ClientFilterSelect from "@/components/dashboard/ClientFilterSelect";
import { PageError } from "@/components/dashboard/PageFeedback";
import { analyzeImport, confirmImport, getImport, CreditsApiError } from "@/lib/importApi";
import { fetchImportEstimate } from "@/lib/creditsApi";
import { fetchCompanyProfile } from "@/lib/companyProfileApi";
import { invalidateCreditsCache } from "@/hooks/useCredits";
import AiCreditsEstimate from "@/components/dashboard/AiCreditsEstimate";
import ImportSuccessPanel from "@/components/dashboard/ImportSuccessPanel";
import {
  AdjustFieldsPanel,
  AssistantSummaryPanel,
  ClientAttachmentBanner,
  LineItemsCards,
  PremiumReadyPanel,
  VerificationWarningsPanel,
} from "@/components/dashboard/ImportAssistantPanels";
import {
  ANALYSIS_STAGE_KEYS,
  buildConfirmPayload,
  computeAmountTtc,
  CONFIRMABLE_KINDS,
  getResolvedClientLabel,
  IMPORT_ACCEPT,
  IMPORT_MAX_FILES,
  sessionToFormState,
} from "@/utils/importDisplay";
import {
  datetimeLocalToIso,
  toDatetimeLocalValue,
} from "@/utils/quoteDisplay";
import { ActionButton } from "@/components/dashboard/ActionButton";
import {
  DETAIL_MODAL_CONTENT_CLASS_2XL,
  DETAIL_MODAL_HEADER_CLASS,
  DETAIL_MODAL_OVERLAY_CLASS,
  DETAIL_MODAL_TITLE_CLASS,
  WorkflowModalFooter,
} from "@/components/dashboard/detailModalLayout";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

const STEPS = [1, 2, 3];
const SUCCESS_STEP = 4;

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

export default function ImportWizard({
  open,
  onOpenChange,
  defaultKind = null,
  resumeSessionId = null,
  onSuccess,
}) {
  const { t, lang } = useDashboardLang();
  const navigate = useNavigate();
  const { clients, loading: clientsLoading } = useClients();
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
  const [pendingFile, setPendingFile] = useState(null);
  const [pendingFiles, setPendingFiles] = useState([]);
  const [estimate, setEstimate] = useState(null);
  const [estimateLoading, setEstimateLoading] = useState(false);
  const [defaultVatRate, setDefaultVatRate] = useState(20);

  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;
    fetchCompanyProfile()
      .then((data) => {
        if (!cancelled) setDefaultVatRate(data?.profile?.defaultVatRate ?? 20);
      })
      .catch(() => {
        if (!cancelled) setDefaultVatRate(20);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

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
    setPendingFile(null);
    setPendingFiles([]);
    setEstimate(null);
    setEstimateLoading(false);
  }, []);

  useEffect(() => {
    if (!open) reset();
  }, [open, reset]);

  useEffect(() => {
    if (!open || !resumeSessionId) return undefined;

    let cancelled = false;
    setError(null);

    (async () => {
      try {
        const data = await getImport(resumeSessionId);
        if (cancelled) return;
        if (data.status !== "pending") {
          setError(t("importWizard.errors.sessionNotPending"));
          return;
        }
        const nextForm = sessionToFormState(data, defaultKind, defaultVatRate);
        setSession(data);
        setForm(nextForm);
        setClientAction(data.clientMatches?.length ? "use_existing" : "create_new");
        setSelectedClientId(data.clientMatches?.[0]?.clientId || "");
        setStep(2);
      } catch (err) {
        if (!cancelled) {
          setError(err.message || t("importWizard.errors.analyze"));
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, resumeSessionId, defaultKind, defaultVatRate, t]);

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
      const nextForm = sessionToFormState(nextSession, defaultKind, defaultVatRate);
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
    [defaultKind, defaultVatRate]
  );

  const loadEstimate = useCallback(async (files) => {
    const selected = Array.isArray(files) ? files : [files];
    if (!selected.length) return;
    setEstimateLoading(true);
    setEstimate(null);
    setError(null);
    try {
      const totalSize = selected.reduce((sum, file) => sum + file.size, 0);
      const primary = selected[0];
      const ext = primary.name.split(".").pop()?.toLowerCase() || "";
      const payload = {
        extension: ext,
        sizeBytes: totalSize,
        mimeType: primary.type || undefined,
      };
      if (selected.length > 1) {
        payload.files = selected.map((file) => ({
          extension: file.name.split(".").pop()?.toLowerCase() || ext,
          sizeBytes: file.size,
          mimeType: file.type || undefined,
        }));
      }
      const data = await fetchImportEstimate(payload);
      setEstimate(data);
    } catch (err) {
      setError(err.message || t("importWizard.errors.analyze"));
      setPendingFile(null);
      setPendingFiles([]);
    } finally {
      setEstimateLoading(false);
    }
  }, [t]);

  const handleFilePick = useCallback(
    (fileList) => {
      if (!fileList?.length || analyzing) return;
      const files = Array.from(fileList).slice(0, IMPORT_MAX_FILES);
      setPendingFiles(files);
      setPendingFile(files.length === 1 ? files[0] : null);
      loadEstimate(files);
      if (inputRef.current) inputRef.current.value = "";
    },
    [analyzing, loadEstimate]
  );

  const handleAnalyze = async (files = pendingFiles.length ? pendingFiles : pendingFile ? [pendingFile] : []) => {
    if (!files.length || analyzing) return;
    setAnalyzing(true);
    setAnalysisProgress(8);
    setAnalysisStageIndex(0);
    setError(null);
    try {
      const result = await analyzeImport(files);
      invalidateCreditsCache();
      applySession(result);
    } catch (err) {
      setAnalyzing(false);
      setAnalysisProgress(0);
      setAnalysisStageIndex(0);
      if (err instanceof CreditsApiError && err.status === 402) {
        setError(
          t("credits.insufficient")
            .replace("{available}", String(err.analysesAvailable ?? "—"))
            .replace("{required}", String(err.analysesRequired ?? "—"))
        );
      } else {
        setError(err.message || t("importWizard.errors.analyze"));
      }
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
      const entityId =
        result.created?.entityId || result.created?.quoteId || result.created?.invoiceId;
      const entityNumber = result.created?.entityNumber || result.created?.number || form.externalNumber;
      setCreatedSummary({
        entityId,
        entityType: form.targetKind,
        clientName: getResolvedClientLabel(session, form, clientAction, selectedClientId),
        amountTTC: form.amountTTC,
        documentDate: form.documentDate,
        number: entityNumber,
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
    t("importWizard.steps.confirm"),
  ];

  const handleViewDocument = () => {
    if (!createdSummary?.entityId) return;
    onOpenChange(false);
    reset();
    const kind = createdSummary.entityType === "invoice" ? "invoice" : "quote";
    navigate(commercialDocumentsPath({ kind, open: createdSummary.entityId }));
  };

  const handleImportAnother = () => {
    reset();
  };

  const handleBackToDashboard = () => {
    onOpenChange(false);
    reset();
    navigate("/dashboard");
  };

  const onSuccessStep = step === SUCCESS_STEP;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        overlayClassName={DETAIL_MODAL_OVERLAY_CLASS}
        className={DETAIL_MODAL_CONTENT_CLASS_2XL}
        data-testid="import-wizard"
      >
        <DialogHeader className={DETAIL_MODAL_HEADER_CLASS}>
          <DialogTitle className={`${DETAIL_MODAL_TITLE_CLASS} flex items-center gap-2`}>
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
            <div className="grid grid-cols-3 gap-1 text-[10px] text-[#6B7280] uppercase tracking-wide mb-4">
              {stepLabels.map((label) => (
                <span key={label} className="truncate">
                  {label}
                </span>
              ))}
            </div>
          </>
        ) : null}

        {error ? <PageError message={error} testId="import-wizard-error" /> : null}

        {onSuccessStep && createdSummary ? (
          <ImportSuccessPanel
            summary={createdSummary}
            onView={handleViewDocument}
            onImportAnother={handleImportAnother}
            onBackToDashboard={handleBackToDashboard}
          />
        ) : null}

        {step === 1 && analyzing && (
          <AnalyzingPanel progress={analysisProgress} stageIndex={analysisStageIndex} t={t} />
        )}

        {step === 1 && !analyzing && !pendingFiles.length && (
          <div
            className={[
              "border-2 border-dashed rounded-2xl p-8 text-center transition-colors",
              dragging ? "border-[#0A2540] bg-[#EFF6FF]/40" : "border-[#E5E7EB] bg-[#FAFAFA]",
              "cursor-pointer",
            ].join(" ")}
            onDrop={(event) => {
              event.preventDefault();
              setDragging(false);
              handleFilePick(event.dataTransfer.files);
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
              multiple
              className="hidden"
              onChange={(event) => handleFilePick(event.target.files)}
            />
            <div className="w-12 h-12 rounded-xl bg-[#EFF6FF] text-[#0A2540] flex items-center justify-center mx-auto mb-4">
              <Upload className="w-5 h-5" />
            </div>
            <p className="text-sm font-medium text-[#111827]">{t("importWizard.dropHint")}</p>
            <p className="text-xs text-[#6B7280] mt-1">{t("importWizard.fileTypes")}</p>
            <p className="text-xs text-[#9CA3AF] mt-1">{t("importWizard.multiImageHint")}</p>
          </div>
        )}

        {step === 1 && !analyzing && pendingFiles.length > 0 && (
          <div className="space-y-4" data-testid="import-wizard-file-ready">
            <div className="rounded-xl border border-[#E5E7EB] bg-white px-4 py-3 space-y-2">
              {pendingFiles.map((file) => (
                <div key={`${file.name}-${file.size}`} className="flex items-center gap-3">
                  <FileText className="w-5 h-5 text-[#4F46E5] shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-[#111827] truncate">{file.name}</p>
                    <p className="text-xs text-[#6B7280]">
                      {(file.size / 1024).toFixed(0)} Ko
                    </p>
                  </div>
                </div>
              ))}
              {pendingFiles.length > 1 ? (
                <p className="text-xs text-[#6B7280] pt-1 border-t border-[#F3F4F6]">
                  {t("importWizard.multiImageSelected").replace("{count}", String(pendingFiles.length))}
                </p>
              ) : null}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setPendingFile(null);
                  setPendingFiles([]);
                  setEstimate(null);
                }}
              >
                {t("credits.changeFile")}
              </Button>
            </div>

            <AiCreditsEstimate estimate={estimate} loading={estimateLoading} />

            <ActionButton
              variant="primary"
              className="w-full justify-center"
              disabled={estimateLoading || !estimate}
              onClick={() => handleAnalyze()}
              data-testid="import-wizard-analyze-btn"
            >
              <Wand2 className="w-4 h-4" />
              {t("credits.analyzeAction")}
            </ActionButton>
          </div>
        )}

        {step === 2 && session && (
          <div className="space-y-4">
            <AssistantSummaryPanel session={session} form={form} t={t} lang={lang} />
            <VerificationWarningsPanel session={session} form={form} t={t} />
            <ClientAttachmentBanner
              session={session}
              form={form}
              clientAction={clientAction}
              selectedClientId={selectedClientId}
              t={t}
            />
            <LineItemsCards session={session} t={t} />

            {session.duplicateWarning && (
              <div className="rounded-xl border border-[#FDE68A] bg-[#FFFBEB] px-4 py-3 text-sm text-[#92400E]">
                {session.duplicateWarning}
              </div>
            )}

            <AdjustFieldsPanel session={session} form={form} updateForm={updateForm} t={t} defaultVatRate={defaultVatRate} />
          </div>
        )}

        {step === 3 && session && (
          <PremiumReadyPanel
            session={session}
            form={form}
            clientAction={clientAction}
            selectedClientId={selectedClientId}
            clients={clients}
            clientsLoading={clientsLoading}
            onClientActionChange={setClientAction}
            onSelectClient={setSelectedClientId}
            updateForm={updateForm}
            t={t}
            lang={lang}
          />
        )}

        {!onSuccessStep ? (
          <div className="flex flex-col gap-2 pt-2">
            {step > 1 && step < 3 && !canGoNext ? (
              <p className="text-[11px] text-[#9CA3AF] text-right" data-testid="import-wizard-next-hint">
                {t("importWizard.nextBlockedStep2")}
              </p>
            ) : null}
            <WorkflowModalFooter>
              {step > 1 && step < SUCCESS_STEP && (
                <ActionButton
                  type="button"
                  variant="secondary"
                  onClick={() => setStep((s) => s - 1)}
                  className="gap-1.5"
                >
                  <ArrowLeft className="w-4 h-4" />
                  {t("importWizard.back")}
                </ActionButton>
              )}
              {step === 2 && (
                <ActionButton
                  type="button"
                  variant="primary"
                  disabled={!canGoNext}
                  onClick={() => setStep(3)}
                  className="gap-1.5"
                >
                  {t("importWizard.next")}
                  <ArrowRight className="w-4 h-4" />
                </ActionButton>
              )}
              {step === 3 && (
                <ActionButton
                  type="button"
                  variant="primary"
                  disabled={!canGoNext || confirming}
                  onClick={handleConfirm}
                  className="gap-1.5 min-w-[200px]"
                  data-testid="import-wizard-confirm"
                >
                  {confirming ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      {t("importWizard.confirming")}
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      {t("importWizard.confirmAuto")}
                    </>
                  )}
                </ActionButton>
              )}
            </WorkflowModalFooter>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
