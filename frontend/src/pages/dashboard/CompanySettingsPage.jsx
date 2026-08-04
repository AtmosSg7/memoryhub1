import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Save } from "lucide-react";
import { useDashboardLang } from "@/hooks/useDashboardLang";
import { usePageTitle } from "@/hooks/usePageTitle";
import PageHeader from "@/components/dashboard/PageHeader";
import SettingsShell from "@/components/dashboard/SettingsShell";
import { PageLoader } from "@/components/dashboard/PageFeedback";
import { ActionButton } from "@/components/dashboard/ActionButton";
import { FORM_LABEL_CLASS } from "@/components/dashboard/detailModalLayout";
import {
  fetchCompanyProfile,
  resolveAssetUrl,
  updateCompanyProfile,
  uploadCompanyLogo,
} from "@/lib/companyProfileApi";

const EMPTY_FORM = {
  legalName: "",
  tradeName: "",
  siret: "",
  vatNumber: "",
  address: "",
  postalCode: "",
  city: "",
  country: "FR",
  phone: "",
  email: "",
  website: "",
  iban: "",
  bic: "",
  bankName: "",
  paymentTerms: "",
  paymentDelayDays: 30,
  latePenaltyRate: "",
  flatRecoveryIndemnity: "",
  defaultVatRate: 20,
  currency: "EUR",
  quotePrefix: "DEV",
  invoicePrefix: "FAC",
  primaryColor: "#0A2540",
  emailSignature: "",
};

export default function CompanySettingsPage() {
  const { t } = useDashboardLang();
  usePageTitle("page.company.title");
  const [form, setForm] = useState(EMPTY_FORM);
  const [logoUrl, setLogoUrl] = useState(null);
  const [pdfLogoUrl, setPdfLogoUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const data = await fetchCompanyProfile();
        if (!mounted) return;
        setForm({ ...EMPTY_FORM, ...data.profile });
        setLogoUrl(resolveAssetUrl(data.logoUrl));
        setPdfLogoUrl(resolveAssetUrl(data.pdfLogoUrl));
      } catch (err) {
        toast.error(err.message || t("company.loadError"));
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [t]);

  const setField = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const handleSave = async () => {
    setSaving(true);
    try {
      const data = await updateCompanyProfile(form);
      setForm({ ...EMPTY_FORM, ...data.profile });
      setLogoUrl(resolveAssetUrl(data.logoUrl));
      setPdfLogoUrl(resolveAssetUrl(data.pdfLogoUrl));
      toast.success(t("company.saveSuccess"));
    } catch (err) {
      toast.error(err.message || t("company.saveError"));
    } finally {
      setSaving(false);
    }
  };

  const handleLogoUpload = async (event, kind = "logo") => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const data = await uploadCompanyLogo(file, kind);
      setLogoUrl(resolveAssetUrl(data.logoUrl));
      setPdfLogoUrl(resolveAssetUrl(data.pdfLogoUrl));
      toast.success(t("company.logoSuccess"));
    } catch (err) {
      toast.error(err.message || t("company.logoError"));
    } finally {
      event.target.value = "";
    }
  };

  return (
    <div className="space-y-6" data-testid="company-settings-page">
      <PageHeader title={t("page.company.title")} subtitle={t("page.company.subtitle")} />

      <SettingsShell activeKey="company">
        {loading ? (
          <PageLoader label={t("auth.loading")} testId="company-settings-loading" />
        ) : (
          <>
            <SettingsShell.Section title={t("company.sections.identity")}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label={t("company.fields.legalName")} value={form.legalName} onChange={(v) => setField("legalName", v)} required />
                <Field label={t("company.fields.tradeName")} value={form.tradeName} onChange={(v) => setField("tradeName", v)} />
                <Field label={t("company.fields.siret")} value={form.siret} onChange={(v) => setField("siret", v)} />
                <Field label={t("company.fields.vatNumber")} value={form.vatNumber} onChange={(v) => setField("vatNumber", v)} />
                <Field label={t("company.fields.address")} value={form.address} onChange={(v) => setField("address", v)} className="md:col-span-2" />
                <Field label={t("company.fields.postalCode")} value={form.postalCode} onChange={(v) => setField("postalCode", v)} />
                <Field label={t("company.fields.city")} value={form.city} onChange={(v) => setField("city", v)} />
                <Field label={t("company.fields.country")} value={form.country} onChange={(v) => setField("country", v)} />
                <Field label={t("company.fields.phone")} value={form.phone} onChange={(v) => setField("phone", v)} />
                <Field label={t("company.fields.email")} value={form.email} onChange={(v) => setField("email", v)} />
                <Field label={t("company.fields.website")} value={form.website} onChange={(v) => setField("website", v)} />
              </div>
            </SettingsShell.Section>

            <SettingsShell.Section title={t("company.sections.banking")}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label={t("company.fields.iban")} value={form.iban} onChange={(v) => setField("iban", v)} className="md:col-span-2" />
                <Field label={t("company.fields.bic")} value={form.bic} onChange={(v) => setField("bic", v)} />
                <Field label={t("company.fields.bankName")} value={form.bankName} onChange={(v) => setField("bankName", v)} />
              </div>
            </SettingsShell.Section>

            <SettingsShell.Section title={t("company.sections.billing")}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label={t("company.fields.paymentTerms")} value={form.paymentTerms} onChange={(v) => setField("paymentTerms", v)} className="md:col-span-2" />
                <Field label={t("company.fields.paymentDelayDays")} value={form.paymentDelayDays} onChange={(v) => setField("paymentDelayDays", v)} type="number" />
                <Field label={t("company.fields.defaultVatRate")} value={form.defaultVatRate} onChange={(v) => setField("defaultVatRate", v)} type="number" />
                <Field label={t("company.fields.latePenaltyRate")} value={form.latePenaltyRate} onChange={(v) => setField("latePenaltyRate", v)} />
                <Field label={t("company.fields.flatRecoveryIndemnity")} value={form.flatRecoveryIndemnity} onChange={(v) => setField("flatRecoveryIndemnity", v)} />
                <Field label={t("company.fields.currency")} value={form.currency} onChange={(v) => setField("currency", v)} />
                <Field label={t("company.fields.quotePrefix")} value={form.quotePrefix} onChange={(v) => setField("quotePrefix", v)} />
                <Field label={t("company.fields.invoicePrefix")} value={form.invoicePrefix} onChange={(v) => setField("invoicePrefix", v)} />
              </div>
            </SettingsShell.Section>

            <SettingsShell.Section title={t("company.sections.branding")}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <LogoUpload label={t("company.fields.logo")} previewUrl={logoUrl} onUpload={(e) => handleLogoUpload(e, "logo")} />
                <LogoUpload label={t("company.fields.pdfLogo")} previewUrl={pdfLogoUrl} onUpload={(e) => handleLogoUpload(e, "pdf")} />
                <Field label={t("company.fields.primaryColor")} value={form.primaryColor} onChange={(v) => setField("primaryColor", v)} />
                <Field label={t("company.fields.emailSignature")} value={form.emailSignature} onChange={(v) => setField("emailSignature", v)} className="md:col-span-2" multiline />
              </div>
            </SettingsShell.Section>

            <div className="flex justify-end">
              <ActionButton variant="primary" onClick={handleSave} disabled={saving} className="gap-2">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {t("company.save")}
              </ActionButton>
            </div>
          </>
        )}
      </SettingsShell>
    </div>
  );
}

function Field({ label, value, onChange, type = "text", required = false, className = "", multiline = false }) {
  const shared =
    "mt-1.5 w-full rounded-xl border border-dash-border bg-[var(--dash-input-bg)] px-3.5 py-2.5 text-sm text-dash-text placeholder:text-dash-text-subtle hover:bg-[var(--dash-input-bg-hover)] focus:outline-none focus:border-dash-accent focus:ring-2 focus:ring-dash-accent/25 transition-colors";
  return (
    <label className={`block ${className}`}>
      <span className={FORM_LABEL_CLASS}>
        {label}
        {required ? " *" : ""}
      </span>
      {multiline ? (
        <textarea rows={3} value={value ?? ""} onChange={(e) => onChange(e.target.value)} className={`${shared} resize-none`} />
      ) : (
        <input
          type={type}
          value={value ?? ""}
          onChange={(e) => onChange(type === "number" ? Number(e.target.value) : e.target.value)}
          className={shared}
        />
      )}
    </label>
  );
}

function LogoUpload({ label, previewUrl, onUpload }) {
  return (
    <label className="block">
      <span className={FORM_LABEL_CLASS}>{label}</span>
      <div className="mt-1.5 flex items-center gap-3">
        {previewUrl ? (
          <img src={previewUrl} alt="" className="w-14 h-14 rounded-lg border border-dash-border object-contain bg-dash-surface" />
        ) : (
          <div className="w-14 h-14 rounded-lg border border-dashed border-[#D1D5DB] bg-dash-bg" />
        )}
        <input type="file" accept="image/png,image/jpeg,image/webp" onChange={onUpload} className="text-sm text-dash-text-muted" />
      </div>
    </label>
  );
}
