import { useRef, useState } from "react";
import { Loader2, Upload } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ActionButton } from "@/components/dashboard/ActionButton";
import { importPhoneCsv, previewPhoneCsv } from "@/lib/phoneApi";

export default function ImportCsvModal({ open, onOpenChange, t, onImported }) {
  const inputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [report, setReport] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const reset = () => {
    setFile(null);
    setPreview(null);
    setReport(null);
    setError("");
    setBusy(false);
    if (inputRef.current) inputRef.current.value = "";
  };

  const handleClose = (next) => {
    if (busy) return;
    if (!next) reset();
    onOpenChange?.(next);
  };

  const runPreview = async (selected) => {
    if (!selected) return;
    setBusy(true);
    setError("");
    setReport(null);
    try {
      const data = await previewPhoneCsv(selected);
      setFile(selected);
      setPreview(data);
    } catch (err) {
      setError(err.message || t("calls.import.error"));
      setPreview(null);
      setFile(null);
    } finally {
      setBusy(false);
    }
  };

  const runImport = async ({ dryRun }) => {
    if (!file || busy) return;
    setBusy(true);
    setError("");
    try {
      const data = await importPhoneCsv(file, { dryRun });
      setReport(data);
      if (!dryRun) {
        onImported?.(data);
      }
    } catch (err) {
      setError(err.message || t("calls.import.error"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent
        className="sm:max-w-lg max-h-[90dvh] overflow-y-auto pb-[max(1.25rem,env(safe-area-inset-bottom))]"
        data-testid="import-csv-modal"
      >
        <DialogHeader>
          <DialogTitle>{t("calls.import.title")}</DialogTitle>
          <DialogDescription>{t("calls.import.subtitle")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <label
            className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-dash-border bg-dash-bg px-4 py-8 cursor-pointer min-h-[120px]"
            data-testid="import-csv-drop"
          >
            <Upload className="w-5 h-5 text-dash-primary" />
            <span className="text-sm text-dash-text">{t("calls.import.chooseFile")}</span>
            <span className="text-xs text-dash-text-subtle">
              {file?.name || t("calls.import.formats")}
            </span>
            <input
              ref={inputRef}
              type="file"
              accept=".csv,text/csv"
              className="sr-only"
              data-testid="import-csv-input"
              onChange={(e) => runPreview(e.target.files?.[0])}
            />
          </label>

          {preview ? (
            <div className="rounded-xl border border-dash-border bg-dash-surface p-3 space-y-2 text-sm" data-testid="import-csv-preview">
              <p>
                {t("calls.import.summary")
                  .replace("{total}", String(preview.totalRows ?? 0))
                  .replace("{valid}", String(preview.validRows ?? 0))
                  .replace("{invalid}", String(preview.invalidRows ?? 0))
                  .replace("{dup}", String(preview.duplicateRows ?? 0))}
              </p>
              {preview.mapping ? (
                <p className="text-xs text-dash-text-muted">
                  {t("calls.import.mapped")}: {Object.keys(preview.mapping).join(", ")}
                </p>
              ) : null}
              {(preview.rows || []).slice(0, 5).map((row) => (
                <div
                  key={row.lineNumber}
                  className="text-xs border-t border-dash-border-soft pt-1.5 flex justify-between gap-2"
                >
                  <span className="truncate">
                    L{row.lineNumber} · {row.phoneNumber || "—"} · {row.status}
                  </span>
                  <span className={row.valid && !row.duplicate ? "text-emerald-700" : "text-red-600"}>
                    {row.duplicate ? "dup" : row.valid ? "ok" : "err"}
                  </span>
                </div>
              ))}
            </div>
          ) : null}

          {report ? (
            <div
              className="rounded-xl bg-emerald-50 text-emerald-900 px-3 py-2 text-sm"
              data-testid="import-csv-report"
            >
              {report.dryRun
                ? t("calls.import.dryRunDone").replace("{count}", String(report.imported ?? 0))
                : t("calls.import.done")
                    .replace("{count}", String(report.imported ?? 0))
                    .replace("{linked}", String(report.linked ?? 0))}
            </div>
          ) : null}

          {error ? (
            <p className="text-sm text-red-600" data-testid="import-csv-error">
              {error}
            </p>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <ActionButton
              variant="secondary"
              disabled={!file || busy}
              onClick={() => runImport({ dryRun: true })}
              data-testid="import-csv-dry-run"
              className="min-h-11"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {t("calls.import.dryRun")}
            </ActionButton>
            <ActionButton
              variant="primary"
              disabled={!file || busy}
              onClick={() => runImport({ dryRun: false })}
              data-testid="import-csv-confirm"
              className="min-h-11"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {t("calls.import.confirm")}
            </ActionButton>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
