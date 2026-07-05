import { useCallback, useRef, useState } from "react";
import { Upload, Loader2 } from "lucide-react";
import { useDashboardLang } from "@/hooks/useDashboardLang";
import {
  ALLOWED_EXTENSIONS_LABEL,
  MAX_UPLOAD_MB,
} from "@/utils/documentDisplay";

const ACCEPT = ".pdf,.jpg,.jpeg,.png,.webp,.zip,.dwg,.doc,.docx,.xls,.xlsx";

export default function DocumentDropzone({
  onUpload,
  disabled = false,
  compact = false,
  testId = "documents-dropzone",
}) {
  const { t, lang } = useDashboardLang();
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);

  const handleFile = useCallback(
    async (file) => {
      if (!file || disabled || uploading) return;
      setUploading(true);
      try {
        await onUpload(file);
      } finally {
        setUploading(false);
        if (inputRef.current) inputRef.current.value = "";
      }
    },
    [disabled, onUpload, uploading]
  );

  const onDrop = (event) => {
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer.files?.[0];
    handleFile(file);
  };

  const onDragOver = (event) => {
    event.preventDefault();
    if (!disabled && !uploading) setDragging(true);
  };

  const onDragLeave = () => setDragging(false);

  const onInputChange = (event) => {
    const file = event.target.files?.[0];
    handleFile(file);
  };

  return (
    <div
      className={[
        "border-2 border-dashed rounded-xl bg-white transition-colors",
        compact ? "p-4" : "p-6",
        dragging ? "border-[#0A2540] bg-[#EFF6FF]/40" : "border-[#E5E7EB]",
        disabled || uploading ? "opacity-60 pointer-events-none" : "cursor-pointer",
      ].join(" ")}
      data-testid={testId}
      onDrop={onDrop}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onClick={() => !disabled && !uploading && inputRef.current?.click()}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          inputRef.current?.click();
        }
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="hidden"
        onChange={onInputChange}
        data-testid={`${testId}-input`}
      />

      <div
        className={[
          "flex items-center gap-4",
          compact ? "" : "flex-col md:flex-row md:justify-between w-full",
        ].join(" ")}
      >
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-[#EFF6FF] text-[#0A2540] flex items-center justify-center shrink-0">
            {uploading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Upload className="w-4 h-4" />
            )}
          </div>
          <div>
            <div className="text-sm font-medium text-[#111827]">
              {uploading
                ? t("documents.uploading")
                : lang === "fr"
                  ? "Glissez un fichier ici"
                  : "Drop a file here"}
            </div>
            <div className="text-[12px] text-[#6B7280]">
              {ALLOWED_EXTENSIONS_LABEL} — max {MAX_UPLOAD_MB} Mo
            </div>
          </div>
        </div>

        {!compact && (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              inputRef.current?.click();
            }}
            disabled={disabled || uploading}
            className="text-xs font-medium bg-[#0A2540] hover:bg-[#173A5E] text-white rounded-md px-3.5 py-2 shrink-0"
            data-testid={`${testId}-btn`}
          >
            {uploading ? t("documents.uploading") : t("common.import")}
          </button>
        )}
      </div>
    </div>
  );
}
