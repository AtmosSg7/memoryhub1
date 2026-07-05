import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useDashboardLang } from "@/hooks/useDashboardLang";
import { useAddClient } from "@/context/AddClientContext";
import { createClient, updateClient } from "@/lib/clientsApi";
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

const MODAL_OVERLAY_CLASS =
  "z-[100] bg-[#0A0A0B]/50 backdrop-blur-md";

const MODAL_CONTENT_CLASS =
  "z-[100] w-[calc(100%-2rem)] max-w-lg max-h-[90vh] overflow-y-auto bg-white border border-[#E7E9EE] rounded-[22px] p-6 sm:p-8 shadow-[0_1px_0_rgba(255,255,255,0.9)_inset,0_20px_60px_-15px_rgba(10,10,11,0.35)] sm:rounded-[22px] [&>button]:rounded-lg [&>button]:text-[#8A8F98] [&>button]:hover:bg-black/[0.04] [&>button]:hover:opacity-100";

const FIELD_CLASS =
  "h-10 rounded-xl border border-[#E7E9EE] bg-white px-4 text-[15px] text-[#111827] shadow-none placeholder:text-[#8A8F98] focus-visible:border-[#0A2540] focus-visible:ring-2 focus-visible:ring-[#0A2540]/15";

const TEXTAREA_CLASS = `${FIELD_CLASS} min-h-[88px] py-3 h-auto`;

const LABEL_CLASS = "text-sm font-medium text-[#374151]";

const SELECT_CONTENT_CLASS =
  "z-[110] rounded-xl border border-[#E7E9EE] bg-white text-[#111827] shadow-lg";

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
        overlayClassName={MODAL_OVERLAY_CLASS}
        className={MODAL_CONTENT_CLASS}
        data-testid="add-client-modal"
      >
        <DialogHeader>
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
              <Label htmlFor="client-name" className={LABEL_CLASS}>
                {t("clientForm.name")} *
              </Label>
              <Input
                id="client-name"
                data-testid="client-form-name"
                value={form.name}
                onChange={setField("name")}
                className={FIELD_CLASS}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="client-contact" className={LABEL_CLASS}>
                {t("clientForm.contactName")}
              </Label>
              <Input
                id="client-contact"
                data-testid="client-form-contact"
                value={form.contactName}
                onChange={setField("contactName")}
                className={FIELD_CLASS}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="client-company" className={LABEL_CLASS}>
                {t("clientForm.company")}
              </Label>
              <Input
                id="client-company"
                data-testid="client-form-company"
                value={form.company}
                onChange={setField("company")}
                className={FIELD_CLASS}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="client-email" className={LABEL_CLASS}>
                {t("clientForm.email")}
              </Label>
              <Input
                id="client-email"
                type="email"
                data-testid="client-form-email"
                value={form.email}
                onChange={setField("email")}
                className={FIELD_CLASS}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="client-phone" className={LABEL_CLASS}>
                {t("clientForm.phone")}
              </Label>
              <Input
                id="client-phone"
                data-testid="client-form-phone"
                value={form.phone}
                onChange={setField("phone")}
                className={FIELD_CLASS}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="client-activity" className={LABEL_CLASS}>
                {t("clientForm.activity")}
              </Label>
              <Input
                id="client-activity"
                data-testid="client-form-activity"
                value={form.activity}
                onChange={setField("activity")}
                className={FIELD_CLASS}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="client-status" className={LABEL_CLASS}>
                {t("clientForm.status")}
              </Label>
              <Select
                value={form.status}
                onValueChange={(value) =>
                  setForm((prev) => ({ ...prev, status: value }))
                }
              >
                <SelectTrigger data-testid="client-form-status" className={FIELD_CLASS}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className={SELECT_CONTENT_CLASS}>
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
              <Label htmlFor="client-address" className={LABEL_CLASS}>
                {t("clientForm.address")}
              </Label>
              <Input
                id="client-address"
                data-testid="client-form-address"
                value={form.address}
                onChange={setField("address")}
                className={FIELD_CLASS}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="client-city" className={LABEL_CLASS}>
                {t("clientForm.city")}
              </Label>
              <Input
                id="client-city"
                data-testid="client-form-city"
                value={form.city}
                onChange={setField("city")}
                className={FIELD_CLASS}
              />
            </div>

            <div className="sm:col-span-2 space-y-2">
              <Label htmlFor="client-notes" className={LABEL_CLASS}>
                {t("clientForm.notes")}
              </Label>
              <Textarea
                id="client-notes"
                data-testid="client-form-notes"
                value={form.notes}
                onChange={setField("notes")}
                rows={3}
                className={TEXTAREA_CLASS}
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={closeAddClient}
              disabled={submitting}
              className="rounded-xl border-[#E5E7EB] bg-white text-[#374151] hover:bg-[#F9FAFB] hover:text-[#111827]"
            >
              {t("clientForm.cancel")}
            </Button>
            <Button
              type="submit"
              data-testid="client-form-submit"
              disabled={submitting}
              className="rounded-xl bg-[#0A2540] text-white hover:bg-[#173A5E]"
            >
              {submitting
                ? t("clientForm.saving")
                : isEdit
                  ? t("clientForm.save")
                  : t("clientForm.create")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
