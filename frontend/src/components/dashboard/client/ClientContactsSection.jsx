import { useMemo, useState } from "react";
import { Mail, MapPin, Phone, Plus, Tag, Trash2, Check } from "lucide-react";
import { toast } from "sonner";
import { ActionButton } from "@/components/dashboard/ActionButton";
import SectionPanel from "@/components/dashboard/client/SectionPanel";
import ClientTagsEditor from "@/components/dashboard/client/ClientTagsEditor";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { normalizeClient } from "@/utils/clientDisplay";
import {
  CONTACT_LABEL_KEYS,
  contactLabelKey,
  createEmptyAddress,
  createEmptyEmail,
  createEmptyPhone,
  formatAddressLine,
  isAddressEmpty,
  prepareContactsForSave,
  removeContactItem,
  setPrimaryContact,
  upsertContactItem,
} from "@/utils/clientContacts";
import { contactSourceLabelKey, isExternalContactSource, markContactUserModified } from "@/utils/contactSync";
import {
  FORM_FIELD_CLASS,
  FORM_LABEL_CLASS,
  FORM_SELECT_CONTENT_CLASS,
} from "@/components/dashboard/detailModalLayout";

function LabelSelect({ value, onChange, t, testId }) {
  return (
    <Select value={contactLabelKey({ label: value })} onValueChange={onChange}>
      <SelectTrigger className={`${FORM_FIELD_CLASS} w-full`} data-testid={testId}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent className={FORM_SELECT_CONTENT_CLASS}>
        {CONTACT_LABEL_KEYS.map((key) => (
          <SelectItem key={key} value={key}>
            {t(`clientContacts.labels.${key}`)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function ContactBadge({ children, primary = false }) {
  return (
    <span
      className={[
        "inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wide border",
        primary
          ? "bg-dash-accent-soft text-[#1D4ED8] border-[#BFDBFE]"
          : "bg-dash-bg text-dash-text-muted border-dash-border",
      ].join(" ")}
    >
      {children}
    </span>
  );
}

function PhoneEmailForm({ kind, draft, setDraft, onCancel, onSave, saving, t }) {
  const valueId = `${kind}-value`;
  return (
    <div className="rounded-xl border border-dash-border bg-dash-surface-muted p-3 space-y-3" data-testid={`${kind}-form`}>
      <div className="space-y-2">
        <Label htmlFor={valueId} className={FORM_LABEL_CLASS}>
          {kind === "phone" ? t("clientForm.phone") : t("clientForm.email")}
        </Label>
        <Input
          id={valueId}
          type={kind === "email" ? "email" : "tel"}
          value={draft.value || ""}
          onChange={(event) => setDraft((prev) => ({ ...prev, value: event.target.value }))}
          className={FORM_FIELD_CLASS}
          data-testid={`${kind}-form-value`}
          autoFocus
        />
      </div>
      <div className="space-y-2">
        <Label className={FORM_LABEL_CLASS}>{t("clientContacts.label")}</Label>
        <LabelSelect
          value={draft.label}
          onChange={(label) => setDraft((prev) => ({ ...prev, label }))}
          t={t}
          testId={`${kind}-form-label`}
        />
      </div>
      <label className="inline-flex items-center gap-2 text-sm text-dash-text-muted">
        <input
          type="checkbox"
          checked={Boolean(draft.isPrimary)}
          onChange={(event) => setDraft((prev) => ({ ...prev, isPrimary: event.target.checked }))}
          data-testid={`${kind}-form-primary`}
        />
        {t("clientContacts.markPrimary")}
      </label>
      <div className="flex flex-wrap gap-2">
        <ActionButton
          type="button"
          variant="primary"
          disabled={saving || !String(draft.value || "").trim()}
          onClick={onSave}
          data-testid={`${kind}-form-save`}
        >
          {t("clientForm.save")}
        </ActionButton>
        <ActionButton type="button" variant="secondary" disabled={saving} onClick={onCancel}>
          {t("clientForm.cancel")}
        </ActionButton>
      </div>
    </div>
  );
}

function AddressForm({ draft, setDraft, onCancel, onSave, saving, t }) {
  return (
    <div className="rounded-xl border border-dash-border bg-dash-surface-muted p-3 space-y-3" data-testid="address-form">
      <div className="space-y-2">
        <Label className={FORM_LABEL_CLASS}>{t("clientContacts.addressLine")}</Label>
        <Input
          value={draft.line1 || ""}
          onChange={(event) => setDraft((prev) => ({ ...prev, line1: event.target.value }))}
          className={FORM_FIELD_CLASS}
          data-testid="address-form-line1"
          autoFocus
        />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label className={FORM_LABEL_CLASS}>{t("clientContacts.postalCode")}</Label>
          <Input
            value={draft.postalCode || ""}
            onChange={(event) => setDraft((prev) => ({ ...prev, postalCode: event.target.value }))}
            className={FORM_FIELD_CLASS}
            data-testid="address-form-postal"
          />
        </div>
        <div className="space-y-2">
          <Label className={FORM_LABEL_CLASS}>{t("clientForm.city")}</Label>
          <Input
            value={draft.city || ""}
            onChange={(event) => setDraft((prev) => ({ ...prev, city: event.target.value }))}
            className={FORM_FIELD_CLASS}
            data-testid="address-form-city"
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label className={FORM_LABEL_CLASS}>{t("clientContacts.label")}</Label>
        <LabelSelect
          value={draft.label}
          onChange={(label) => setDraft((prev) => ({ ...prev, label }))}
          t={t}
          testId="address-form-label"
        />
      </div>
      <label className="inline-flex items-center gap-2 text-sm text-dash-text-muted">
        <input
          type="checkbox"
          checked={Boolean(draft.isPrimary)}
          onChange={(event) => setDraft((prev) => ({ ...prev, isPrimary: event.target.checked }))}
          data-testid="address-form-primary"
        />
        {t("clientContacts.markPrimary")}
      </label>
      <div className="flex flex-wrap gap-2">
        <ActionButton
          type="button"
          variant="primary"
          disabled={saving || isAddressEmpty(draft)}
          onClick={onSave}
          data-testid="address-form-save"
        >
          {t("clientForm.save")}
        </ActionButton>
        <ActionButton type="button" variant="secondary" disabled={saving} onClick={onCancel}>
          {t("clientForm.cancel")}
        </ActionButton>
      </div>
    </div>
  );
}

function ContactChannel({
  kind,
  icon: Icon,
  title,
  items,
  onCommit,
  saving,
  t,
}) {
  const [mode, setMode] = useState(null); // null | "add" | editId
  const [draft, setDraft] = useState(null);

  const startAdd = () => {
    const empty =
      kind === "phone" ? createEmptyPhone() : kind === "email" ? createEmptyEmail() : createEmptyAddress();
    empty.isPrimary = items.length === 0;
    setDraft(empty);
    setMode("add");
  };

  const startEdit = (item) => {
    setDraft({ ...item });
    setMode(item.id);
  };

  const cancel = () => {
    setMode(null);
    setDraft(null);
  };

  const saveDraft = async () => {
    if (!draft) return;
    if (kind === "address") {
      if (isAddressEmpty(draft)) {
        toast.error(t("clientContacts.errors.addressRequired"));
        return;
      }
    } else if (!String(draft.value || "").trim()) {
      toast.error(
        kind === "phone"
          ? t("clientContacts.errors.phoneRequired")
          : t("clientContacts.errors.emailRequired")
      );
      return;
    }

    const nextItem =
      kind === "address"
        ? markContactUserModified(
            {
              ...draft,
              line1: String(draft.line1 || "").trim(),
              line2: String(draft.line2 || "").trim() || null,
              city: String(draft.city || "").trim() || null,
              postalCode: String(draft.postalCode || "").trim() || null,
              country: (draft.country || "FR").toUpperCase().slice(0, 2),
              label: contactLabelKey(draft),
            },
            { actor: "user" },
          )
        : markContactUserModified(
            {
              ...draft,
              value: String(draft.value || "").trim(),
              label: contactLabelKey(draft),
            },
            { actor: "user" },
          );

    const next = prepareContactsForSave(upsertContactItem(items, nextItem));
    await onCommit(next);
    cancel();
  };

  const handlePrimary = async (id) => {
    await onCommit(prepareContactsForSave(setPrimaryContact(items, id)));
  };

  const handleRemove = async (id) => {
    await onCommit(prepareContactsForSave(removeContactItem(items, id)));
  };

  return (
    <div className="space-y-3" data-testid={`client-contact-channel-${kind}`}>
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-sm font-semibold text-dash-text inline-flex items-center gap-2">
          <Icon className="w-4 h-4 text-dash-primary" />
          {title}
        </h4>
        {mode === null ? (
          <ActionButton
            type="button"
            variant="quick"
            onClick={startAdd}
            disabled={saving}
            className="gap-1"
            data-testid={`${kind}-add`}
          >
            <Plus className="w-3.5 h-3.5" />
            {t("clientContacts.add")}
          </ActionButton>
        ) : null}
      </div>

      <ul className="space-y-2">
        {items.map((item) => {
          if (mode === item.id && draft) {
            return (
              <li key={item.id}>
                {kind === "address" ? (
                  <AddressForm
                    draft={draft}
                    setDraft={setDraft}
                    onCancel={cancel}
                    onSave={saveDraft}
                    saving={saving}
                    t={t}
                  />
                ) : (
                  <PhoneEmailForm
                    kind={kind}
                    draft={draft}
                    setDraft={setDraft}
                    onCancel={cancel}
                    onSave={saveDraft}
                    saving={saving}
                    t={t}
                  />
                )}
              </li>
            );
          }

          const display =
            kind === "address" ? formatAddressLine(item) : item.value;

          return (
            <li
              key={item.id}
              className="rounded-xl border border-dash-border bg-dash-surface px-3 py-2.5"
              data-testid={`${kind}-item-${item.id}`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:justify-between">
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <ContactBadge>{t(`clientContacts.labels.${contactLabelKey(item)}`)}</ContactBadge>
                    {item.isPrimary ? (
                      <ContactBadge primary>{t("clientContacts.primary")}</ContactBadge>
                    ) : null}
                    {isExternalContactSource(item) ? (
                      <ContactBadge>
                        <span data-testid={`${kind}-source-${item.id}`}>
                          {t(contactSourceLabelKey(item))}
                        </span>
                      </ContactBadge>
                    ) : null}
                    {item.syncStatus === "conflict" ? (
                      <ContactBadge>
                        <span
                          className="text-amber-800"
                          data-testid={`${kind}-conflict-${item.id}`}
                          title={t("clientContacts.conflictHint")}
                        >
                          {t("clientContacts.conflict")}
                        </span>
                      </ContactBadge>
                    ) : null}
                  </div>
                  <p className="text-sm font-medium text-dash-text break-words">{display || "—"}</p>
                </div>
                <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                  {!item.isPrimary ? (
                    <ActionButton
                      type="button"
                      variant="ghost"
                      className="h-8 px-2 text-xs gap-1"
                      disabled={saving}
                      onClick={() => handlePrimary(item.id)}
                      data-testid={`${kind}-set-primary-${item.id}`}
                    >
                      <Check className="w-3.5 h-3.5" />
                      {t("clientContacts.setPrimary")}
                    </ActionButton>
                  ) : null}
                  <ActionButton
                    type="button"
                    variant="ghost"
                    className="h-8 px-2 text-xs"
                    disabled={saving}
                    onClick={() => startEdit(item)}
                    data-testid={`${kind}-edit-${item.id}`}
                  >
                    {t("clientDetail.edit")}
                  </ActionButton>
                  <ActionButton
                    type="button"
                    variant="dangerIcon"
                    disabled={saving}
                    onClick={() => handleRemove(item.id)}
                    aria-label={t("actions.delete")}
                    data-testid={`${kind}-delete-${item.id}`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </ActionButton>
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      {!items.length && mode === null ? (
        <p className="text-xs text-dash-text-subtle">{t(`clientContacts.empty.${kind}`)}</p>
      ) : null}

      {mode === "add" && draft ? (
        kind === "address" ? (
          <AddressForm
            draft={draft}
            setDraft={setDraft}
            onCancel={cancel}
            onSave={saveDraft}
            saving={saving}
            t={t}
          />
        ) : (
          <PhoneEmailForm
            kind={kind}
            draft={draft}
            setDraft={setDraft}
            onCancel={cancel}
            onSave={saveDraft}
            saving={saving}
            t={t}
          />
        )
      ) : null}
    </div>
  );
}

export default function ClientContactsSection({ client, onSaveContacts, onSaveTags, saving = false, t }) {
  const normalized = useMemo(() => normalizeClient(client), [client]);

  return (
    <div className="space-y-4" data-testid="client-contacts-section">
      <SectionPanel
        id="client-section-contacts"
        title={t("clientContacts.title")}
        subtitle={t("clientContacts.subtitle")}
        testId="client-contacts-panel"
      >
        <div className="space-y-6">
          <ContactChannel
            kind="phone"
            icon={Phone}
            title={t("clientContacts.phones")}
            items={normalized.phones || []}
            saving={saving}
            t={t}
            onCommit={(phones) => onSaveContacts({ phones })}
          />
          <div className="border-t border-dash-border-soft" />
          <ContactChannel
            kind="email"
            icon={Mail}
            title={t("clientContacts.emails")}
            items={normalized.emails || []}
            saving={saving}
            t={t}
            onCommit={(emails) => onSaveContacts({ emails })}
          />
          <div className="border-t border-dash-border-soft" />
          <ContactChannel
            kind="address"
            icon={MapPin}
            title={t("clientContacts.addresses")}
            items={normalized.addresses || []}
            saving={saving}
            t={t}
            onCommit={(addresses) => onSaveContacts({ addresses })}
          />
        </div>
      </SectionPanel>

      <SectionPanel
        id="client-section-tags"
        title={t("clientContacts.tagsTitle")}
        subtitle={t("clientContacts.tagsSubtitle")}
        icon={Tag}
        testId="client-tags-panel"
      >
        <ClientTagsEditor
          tags={normalized.tags || []}
          saving={saving}
          t={t}
          onChange={onSaveTags}
        />
      </SectionPanel>
    </div>
  );
}
