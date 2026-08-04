import { useEffect, useState } from "react";
import { Search, User } from "lucide-react";
import { useDashboardLang } from "@/hooks/useDashboardLang";
import { useSearch, SEARCH_MIN_CHARS } from "@/hooks/useSearch";
import { ActionButton } from "@/components/dashboard/ActionButton";
import { InlineLoader } from "@/components/dashboard/PageFeedback";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  NESTED_MODAL_FORM_CONTENT_CLASS,
  NESTED_MODAL_OVERLAY_CLASS,
  DetailModalFooter,
} from "@/components/dashboard/detailModalLayout";

export default function AssociateClientModal({
  open,
  onClose,
  onConfirm,
  submitting = false,
  title,
  description,
}) {
  const { t } = useDashboardLang();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(null);
  const { data, loading, error, minChars } = useSearch(query, { enabled: open });

  useEffect(() => {
    if (!open) {
      setQuery("");
      setSelected(null);
    }
  }, [open]);

  const clients = data?.groups?.clients?.items || [];

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent
        overlayClassName={NESTED_MODAL_OVERLAY_CLASS}
        className={NESTED_MODAL_FORM_CONTENT_CLASS}
        data-testid="associate-client-modal"
      >
        <DialogHeader className="space-y-1 pb-1">
          <DialogTitle className="font-cabinet text-xl font-bold tracking-[-0.02em] text-dash-text">
            {title || t("unlinkedEmails.associateTitle")}
          </DialogTitle>
          <DialogDescription className="text-[#4B5563]">
            {description || t("unlinkedEmails.associateDesc")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-dash-text-subtle" />
            <Input
              type="search"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setSelected(null);
              }}
              placeholder={t("unlinkedEmails.clientSearchPlaceholder")}
              className="pl-8 h-10"
              data-testid="associate-client-search"
              autoFocus
            />
          </div>

          {query.trim().length > 0 && query.trim().length < minChars ? (
            <p className="text-xs text-dash-text-subtle">
              {t("search.minChars").replace("{count}", String(SEARCH_MIN_CHARS))}
            </p>
          ) : null}

          {loading ? (
            <InlineLoader label={t("search.loading")} className="py-4" />
          ) : error ? (
            <p className="text-sm text-[#991B1B]">{error}</p>
          ) : clients.length === 0 && query.trim().length >= minChars ? (
            <p className="text-sm text-[#6B7280] py-2">{t("unlinkedEmails.noClientMatch")}</p>
          ) : (
            <ul className="max-h-64 overflow-y-auto divide-y divide-dash-border-soft rounded-xl border border-dash-border">
              {clients.map((item) => {
                const isSelected = selected?.id === item.id;
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => setSelected(item)}
                      className={[
                        "w-full text-left px-3 py-2.5 flex items-start gap-2.5 transition-colors",
                        isSelected ? "bg-dash-accent-soft" : "hover:bg-dash-surface-muted",
                      ].join(" ")}
                      data-testid={`associate-client-option-${item.id}`}
                    >
                      <User className="w-4 h-4 mt-0.5 text-[#6B7280] shrink-0" />
                      <span className="min-w-0">
                        <span className="block text-sm font-medium text-dash-text truncate">
                          {item.title}
                        </span>
                        {item.subtitle ? (
                          <span className="block text-xs text-[#6B7280] truncate">{item.subtitle}</span>
                        ) : null}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <DetailModalFooter>
          <ActionButton variant="ghost" onClick={onClose} disabled={submitting}>
            {t("clientForm.cancel")}
          </ActionButton>
          <ActionButton
            variant="primary"
            disabled={!selected || submitting}
            onClick={() => selected && onConfirm(selected)}
            data-testid="associate-client-confirm"
          >
            {t("unlinkedEmails.confirmAssociate")}
          </ActionButton>
        </DetailModalFooter>
      </DialogContent>
    </Dialog>
  );
}
