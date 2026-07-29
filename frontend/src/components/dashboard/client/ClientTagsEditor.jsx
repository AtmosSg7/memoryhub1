import { useState } from "react";
import { Plus, X } from "lucide-react";
import { ActionButton } from "@/components/dashboard/ActionButton";
import { Input } from "@/components/ui/input";
import { addUniqueTag } from "@/utils/clientContacts";

export default function ClientTagsEditor({ tags = [], onChange, saving = false, t }) {
  const [draft, setDraft] = useState("");

  const handleAdd = () => {
    const { tags: next, added } = addUniqueTag(tags, draft);
    if (!added) {
      setDraft("");
      return;
    }
    onChange?.(next);
    setDraft("");
  };

  const handleRemove = (tag) => {
    onChange?.((tags || []).filter((item) => item !== tag));
  };

  return (
    <div className="space-y-3" data-testid="client-tags-editor">
      <div className="flex flex-wrap gap-1.5 min-h-[28px]">
        {(tags || []).length ? (
          tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-[#F3F4F6] text-[#374151] border border-[#E5E7EB]"
              data-testid={`client-tag-${tag}`}
            >
              {tag}
              <button
                type="button"
                onClick={() => handleRemove(tag)}
                disabled={saving}
                className="text-[#9CA3AF] hover:text-[#991B1B] transition-colors"
                aria-label={t("clientContacts.removeTag")}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </span>
          ))
        ) : (
          <p className="text-xs text-[#9CA3AF]">{t("clientContacts.tagsEmpty")}</p>
        )}
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <Input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              handleAdd();
            }
          }}
          placeholder={t("clientContacts.tagsPlaceholder")}
          className="h-10 rounded-xl border-[#E7E9EE]"
          disabled={saving}
          data-testid="client-tag-input"
        />
        <ActionButton
          type="button"
          variant="secondary"
          onClick={handleAdd}
          disabled={saving || !draft.trim()}
          className="gap-1.5 shrink-0"
          data-testid="client-tag-add"
        >
          <Plus className="w-4 h-4" />
          {t("clientContacts.addTag")}
        </ActionButton>
      </div>
      <p className="text-[11px] text-[#9CA3AF]">{t("clientContacts.tagsHint")}</p>
    </div>
  );
}
