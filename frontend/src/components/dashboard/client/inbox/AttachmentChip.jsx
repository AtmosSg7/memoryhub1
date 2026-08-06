import { memo } from "react";
import { FileText, Image as ImageIcon, Paperclip } from "lucide-react";
import { formatFileSize, isImageAttachment } from "./inboxUtils";

function AttachmentChip({ attachment, compact = false }) {
  if (!attachment) return null;
  const image = isImageAttachment(attachment);
  const size = formatFileSize(attachment.size);
  const href = attachment.externalUrl;

  const content = (
    <>
      {image && href && !compact ? (
        <img
          src={href}
          alt={attachment.filename || "image"}
          className="h-14 w-14 rounded-md object-cover border border-dash-border-soft bg-dash-surface-muted"
          loading="lazy"
          onError={(e) => {
            e.currentTarget.style.display = "none";
          }}
        />
      ) : (
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-dash-surface-muted text-dash-text-muted">
          {image ? <ImageIcon className="w-4 h-4" /> : attachment.kind === "pdf" ? (
            <FileText className="w-4 h-4" />
          ) : (
            <Paperclip className="w-4 h-4" />
          )}
        </span>
      )}
      <span className="min-w-0">
        <span className="block text-[11px] font-medium text-dash-text truncate max-w-[160px]">
          {attachment.filename || attachment.kind || "file"}
        </span>
        {size ? (
          <span className="block text-[10px] text-dash-text-subtle">{size}</span>
        ) : null}
      </span>
    </>
  );

  const className =
    "inline-flex items-center gap-2 rounded-lg border border-dash-border-soft bg-dash-surface px-2 py-1.5 text-left";

  if (href) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        className={`${className} hover:bg-dash-bg transition-colors`}
        data-testid={`attachment-${attachment.id}`}
      >
        {content}
      </a>
    );
  }

  return (
    <div className={className} data-testid={`attachment-${attachment.id}`}>
      {content}
    </div>
  );
}

export default memo(AttachmentChip);
