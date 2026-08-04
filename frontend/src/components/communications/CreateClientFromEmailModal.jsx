import { useEffect, useState } from "react";
import { useDashboardLang } from "@/hooks/useDashboardLang";
import { ActionButton } from "@/components/dashboard/ActionButton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  FORM_FIELD_CLASS,
  FORM_LABEL_CLASS,
} from "@/components/dashboard/detailModalLayout";
import { InlineLoader } from "@/components/dashboard/PageFeedback";

const EMPTY = { name: "", contactName: "", email: "", phone: "", company: "" };

export default function CreateClientFromEmailModal({
  open,
  onClose,
  onConfirm,
  prefill,
  loading = false,
  submitting = false,
}) {
  const { t } = useDashboardLang();
  const [form, setForm] = useState(EMPTY);

  useEffect(() => {
    if (!open) {
      setForm(EMPTY);
      return;
    }
    if (prefill) {
      setForm({
        name: prefill.name || "",
        contactName: prefill.contactName || "",
        email: prefill.email || "",
        phone: prefill.phone || "",
        company: prefill.company || "",
      });
    }
  }, [open, prefill]);

  const setField = (field) => (event) => {
    setForm((prev) => ({ ...prev, [field]: event.target.value }));
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent
        overlayClassName={NESTED_MODAL_OVERLAY_CLASS}
        className={NESTED_MODAL_FORM_CONTENT_CLASS}
        data-testid="create-client-from-email-modal"
      >
        <DialogHeader className="space-y-1 pb-1">
          <DialogTitle className="font-cabinet text-xl font-bold tracking-[-0.02em] text-dash-text">
            {t("unlinkedEmails.createTitle")}
          </DialogTitle>
          <DialogDescription className="text-[#4B5563]">
            {t("unlinkedEmails.createDesc")}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <InlineLoader label={t("unlinkedEmails.loading")} className="py-8" />
        ) : (
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (!form.name.trim()) return;
              onConfirm({
                name: form.name.trim(),
                contactName: form.contactName.trim() || undefined,
                email: form.email.trim() || undefined,
                phone: form.phone.trim() || undefined,
                company: form.company.trim() || undefined,
              });
            }}
          >
            <div className="space-y-1.5">
              <Label className={FORM_LABEL_CLASS}>{t("clientForm.name")}</Label>
              <Input
                className={FORM_FIELD_CLASS}
                value={form.name}
                onChange={setField("name")}
                required
                data-testid="create-from-email-name"
              />
            </div>
            <div className="space-y-1.5">
              <Label className={FORM_LABEL_CLASS}>{t("clientForm.email")}</Label>
              <Input
                className={FORM_FIELD_CLASS}
                type="email"
                value={form.email}
                onChange={setField("email")}
                data-testid="create-from-email-email"
              />
            </div>
            <div className="space-y-1.5">
              <Label className={FORM_LABEL_CLASS}>{t("clientForm.company")}</Label>
              <Input
                className={FORM_FIELD_CLASS}
                value={form.company}
                onChange={setField("company")}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className={FORM_LABEL_CLASS}>{t("clientForm.contactName")}</Label>
                <Input
                  className={FORM_FIELD_CLASS}
                  value={form.contactName}
                  onChange={setField("contactName")}
                />
              </div>
              <div className="space-y-1.5">
                <Label className={FORM_LABEL_CLASS}>{t("clientForm.phone")}</Label>
                <Input
                  className={FORM_FIELD_CLASS}
                  value={form.phone}
                  onChange={setField("phone")}
                />
              </div>
            </div>

            <DetailModalFooter>
              <ActionButton type="button" variant="ghost" onClick={onClose} disabled={submitting}>
                {t("clientForm.cancel")}
              </ActionButton>
              <ActionButton
                type="submit"
                variant="primary"
                disabled={submitting || !form.name.trim()}
                data-testid="create-from-email-confirm"
              >
                {t("unlinkedEmails.confirmCreate")}
              </ActionButton>
            </DetailModalFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
