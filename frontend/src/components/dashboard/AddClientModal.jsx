import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useDashboardLang } from "@/hooks/useDashboardLang";
import { useAddClient } from "@/context/AddClientContext";
import { createClient, updateClient } from "@/lib/clientsApi";
import { ActionButton } from "@/components/dashboard/ActionButton";
import {
  DETAIL_MODAL_FORM_CONTENT_CLASS,
  DETAIL_MODAL_OVERLAY_CLASS,
  DetailModalFooter,
  FORM_FIELD_CLASS,
  FORM_LABEL_CLASS,
  FORM_SELECT_CONTENT_CLASS,
  FORM_TEXTAREA_CLASS,
} from "@/components/dashboard/detailModalLayout";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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

const EMPTY_FORM = {
  name: "",
  contactName: "",
  email: "",
  phone: "",
  company: "",
  activity: "",
  address: "",
  city: "",
  status: "new",
  notes: "",
};

const STATUS_OPTIONS = ["new", "active", "pending", "dormant"];

function clientToForm(client) {
  if (!client) return { ...EMPTY_FORM };
  return {
    name: client.name || "",
    contactName: client.contactName || "",
    email: client.email || "",
    phone: client.phone || "",
    company: client.company || "",
    activity: client.activity || "",
    address: client.address || "",
    city: client.city || "",
    status: client.status || "new",
    notes: client.notes || "",
  };
}

export default function AddClientModal() {
  const { t } = useDashboardLang();
  const {
    isOpen,
    editingClient,
    closeAddClient,
    notifyClientsChanged,
  } = useAddClient();
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);

  const isEdit = Boolean(editingClient);

  useEffect(() => {
    if (isOpen) {
      setForm(clientToForm(editingClient));
    }
  }, [isOpen, editingClient]);

  const setField = (field) => (event) => {
    setForm((prev) => ({ ...prev, [field]: event.target.value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const name = form.name.trim();
    if (!name) {
      toast.error(t("clientForm.errors.nameRequired"));
      return;
    }

    const payload = {
      name,
      contactName: form.contactName.trim() || undefined,
      email: form.email.trim() || undefined,
      phone: form.phone.trim() || undefined,
      company: form.company.trim() || undefined,
      activity: form.activity.trim() || undefined,
      address: form.address.trim() || undefined,
      city: form.city.trim() || undefined,
      status: form.status,
      notes: form.notes.trim() || undefined,
    };

    setSubmitting(true);
    try {
      if (isEdit) {
        await updateClient(editingClient.id, payload);
        toast.success(t("toast.clientUpdated"));
      } else {
        await createClient(payload);
        toast.success(t("toast.clientCreated"));
      }
      notifyClientsChanged();
      closeAddClient();
    } catch (err) {
      toast.error(err.message || t("toast.clientError"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && closeAddClient()}>
      <DialogContent
        overlayClassName={DETAIL_MODAL_OVERLAY_CLASS}
        className={DETAIL_MODAL_FORM_CONTENT_CLASS}
        data-testid="add-client-modal"
      >
        <DialogHeader className="space-y-1 pb-1">
          <DialogTitle className="font-cabinet text-xl font-bold tracking-[-0.02em] text-[#111827]">
            {isEdit ? t("clientForm.editTitle") : t("clientForm.addTitle")}
          </DialogTitle>
          <DialogDescription className="text-[#4B5563]">
            {isEdit ? t("clientForm.editSubtitle") : t("clientForm.addSubtitle")}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2 space-y-2">
              <Label htmlFor="client-name" className={FORM_LABEL_CLASS}>
                {t("clientForm.name")} *
              </Label>
              <Input
                id="client-name"
                data-testid="client-form-name"
                value={form.name}
                onChange={setField("name")}
                className={FORM_FIELD_CLASS}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="client-contact" className={FORM_LABEL_CLASS}>
                {t("clientForm.contactName")}
              </Label>
              <Input
                id="client-contact"
                data-testid="client-form-contact"
                value={form.contactName}
                onChange={setField("contactName")}
                className={FORM_FIELD_CLASS}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="client-company" className={FORM_LABEL_CLASS}>
                {t("clientForm.company")}
              </Label>
              <Input
                id="client-company"
                data-testid="client-form-company"
                value={form.company}
                onChange={setField("company")}
                className={FORM_FIELD_CLASS}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="client-email" className={FORM_LABEL_CLASS}>
                {t("clientForm.email")}
              </Label>
              <Input
                id="client-email"
                type="email"
                data-testid="client-form-email"
                value={form.email}
                onChange={setField("email")}
                className={FORM_FIELD_CLASS}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="client-phone" className={FORM_LABEL_CLASS}>
                {t("clientForm.phone")}
              </Label>
              <Input
                id="client-phone"
                data-testid="client-form-phone"
                value={form.phone}
                onChange={setField("phone")}
                className={FORM_FIELD_CLASS}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="client-activity" className={FORM_LABEL_CLASS}>
                {t("clientForm.activity")}
              </Label>
              <Input
                id="client-activity"
                data-testid="client-form-activity"
                value={form.activity}
                onChange={setField("activity")}
                className={FORM_FIELD_CLASS}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="client-status" className={FORM_LABEL_CLASS}>
                {t("clientForm.status")}
              </Label>
              <Select
                value={form.status}
                onValueChange={(value) =>
                  setForm((prev) => ({ ...prev, status: value }))
                }
              >
                <SelectTrigger data-testid="client-form-status" className={FORM_FIELD_CLASS}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className={FORM_SELECT_CONTENT_CLASS}>
                  {STATUS_OPTIONS.map((status) => (
                    <SelectItem
                      key={status}
                      value={status}
                      className="rounded-lg focus:bg-[#F3F4F6] focus:text-[#111827]"
                    >
                      {t(`status.${status}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="client-address" className={FORM_LABEL_CLASS}>
                {t("clientForm.address")}
              </Label>
              <Input
                id="client-address"
                data-testid="client-form-address"
                value={form.address}
                onChange={setField("address")}
                className={FORM_FIELD_CLASS}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="client-city" className={FORM_LABEL_CLASS}>
                {t("clientForm.city")}
              </Label>
              <Input
                id="client-city"
                data-testid="client-form-city"
                value={form.city}
                onChange={setField("city")}
                className={FORM_FIELD_CLASS}
              />
            </div>

            <div className="sm:col-span-2 space-y-2">
              <Label htmlFor="client-notes" className={FORM_LABEL_CLASS}>
                {t("clientForm.notes")}
              </Label>
              <Textarea
                id="client-notes"
                data-testid="client-form-notes"
                value={form.notes}
                onChange={setField("notes")}
                rows={3}
                className={FORM_TEXTAREA_CLASS}
              />
            </div>
          </div>

          <DetailModalFooter
            primary={
              <ActionButton
                type="submit"
                variant="primary"
                data-testid="client-form-submit"
                disabled={submitting}
              >
                {submitting
                  ? t("clientForm.saving")
                  : isEdit
                    ? t("clientForm.save")
                    : t("actions.createClient")}
              </ActionButton>
            }
            secondary={
              <ActionButton
                type="button"
                variant="secondary"
                onClick={closeAddClient}
                disabled={submitting}
              >
                {t("clientForm.cancel")}
              </ActionButton>
            }
          />
        </form>
      </DialogContent>
    </Dialog>
  );
}
