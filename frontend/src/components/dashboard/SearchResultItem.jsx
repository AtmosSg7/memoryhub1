import { useNavigate } from "react-router-dom";
import { Users, StickyNote, FileText, Receipt, Mail } from "lucide-react";
import { useAddNote } from "@/context/AddNoteContext";
import { getNote } from "@/lib/notesApi";

const TYPE_CONFIG = {
  client: { icon: Users, color: "text-dash-primary", bg: "bg-dash-accent-soft" },
  note: { icon: StickyNote, color: "text-[#065F46]", bg: "bg-[#ECFDF5]" },
  document: { icon: FileText, color: "text-[#7C2D12]", bg: "bg-[#FFF7ED]" },
  quote: { icon: FileText, color: "text-dash-primary", bg: "bg-dash-accent-soft" },
  invoice: { icon: Receipt, color: "text-[#065F46]", bg: "bg-[#ECFDF5]" },
  email: { icon: Mail, color: "text-[#1E3A5F]", bg: "bg-[#EEF2FF]" },
  communication: { icon: Mail, color: "text-[#1E3A5F]", bg: "bg-[#EEF2FF]" },
};

export default function SearchResultItem({ item, onSelect, compact = false, testId }) {
  const navigate = useNavigate();
  const { openEditNote } = useAddNote();
  const config = TYPE_CONFIG[item.type] || TYPE_CONFIG.client;
  const Icon = config.icon;

  const handleClick = async () => {
    onSelect?.();

    if (item.type === "quote" || item.type === "invoice") {
      navigate(`/dashboard/documents?open=${item.id}`);
      return;
    }

    if (item.type === "note" && item.id) {
      try {
        const note = await getNote(item.id);
        openEditNote(note);
      } catch {
        navigate(item.url);
      }
      return;
    }

    navigate(item.url);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      data-testid={testId}
      className={[
        "w-full flex items-start gap-3 text-left transition-colors hover:bg-dash-bg",
        compact ? "px-3 py-2.5" : "px-4 py-3",
      ].join(" ")}
    >
      <div
        className={[
          "shrink-0 rounded-lg flex items-center justify-center",
          config.bg,
          compact ? "w-7 h-7" : "w-8 h-8",
        ].join(" ")}
      >
        <Icon className={["w-3.5 h-3.5", config.color].join(" ")} strokeWidth={1.75} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-medium text-dash-text truncate">{item.title}</div>
        {item.subtitle && (
          <div className="text-[11.5px] text-dash-text-muted truncate mt-0.5">{item.subtitle}</div>
        )}
        {item.matchPreview && (
          <div
            className={[
              "text-dash-text-subtle line-clamp-2 mt-1 leading-relaxed",
              compact ? "text-[10.5px]" : "text-[11.5px]",
            ].join(" ")}
          >
            {item.matchPreview}
          </div>
        )}
      </div>
    </button>
  );
}
