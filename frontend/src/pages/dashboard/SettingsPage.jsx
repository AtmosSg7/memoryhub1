import { useNavigate } from "react-router-dom";
import { useDashboardLang } from "@/hooks/useDashboardLang";
import { useAuth } from "@/context/AuthContext";
import PageHeader from "@/components/dashboard/PageHeader";
import { Save } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

export default function SettingsPage() {
  const { t, lang, setLang } = useDashboardLang();
  const { user } = useAuth();
  const navigate = useNavigate();

  const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(" ") || "—";

  return (
    <div className="space-y-6" data-testid="settings-page">
      <PageHeader
        title={t("page.settings.title")}
        subtitle={t("page.settings.subtitle")}
        primaryLabel={t("common.saveDraft")}
        primaryIcon={Save}
        onPrimary={() => toast.success(t("common.saveDraft"), { description: t("toast.mockOnly") })}
        testId="settings-header"
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <nav className="lg:col-span-1 space-y-1 text-sm">
          {[
            { label: lang === "fr" ? "Profil" : "Profile", path: "/profile" },
            { label: lang === "fr" ? "Entreprise" : "Company", path: null },
            { label: lang === "fr" ? "Équipe" : "Team", path: null },
            { label: lang === "fr" ? "Facturation" : "Billing", path: "/billing" },
            { label: lang === "fr" ? "Notifications" : "Notifications", path: null },
            { label: lang === "fr" ? "Sécurité" : "Security", path: null },
          ].map((s, i) => (
            <button
              key={s.label}
              type="button"
              onClick={() => s.path && navigate(s.path)}
              data-testid={`settings-tab-${i}`}
              className={
                i === 0
                  ? "w-full text-left px-3 py-2 rounded-lg bg-[#0A2540] text-white font-medium"
                  : "w-full text-left px-3 py-2 rounded-lg text-[#4B5563] hover:bg-[#F3F4F6]"
              }
            >
              {s.label}
            </button>
          ))}
        </nav>

        <div className="lg:col-span-2 space-y-4">
          <Section title={lang === "fr" ? "Informations du profil" : "Profile information"}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label={lang === "fr" ? "Nom complet" : "Full name"} value={fullName} />
              <Field label="Email" value={user?.email || ""} />
              <Field label={lang === "fr" ? "Entreprise" : "Company"} value={user?.companyName || ""} />
              <Field label={lang === "fr" ? "Rôle" : "Role"} value={lang === "fr" ? "Gérant(e)" : "Owner"} />
            </div>
          </Section>

          <Section title={lang === "fr" ? "Préférences" : "Preferences"}>
            <div className="space-y-3">
              <Row label={lang === "fr" ? "Langue de l'interface" : "Interface language"}>
                <div className="flex items-center bg-[#F3F4F6] rounded-md p-0.5">
                  {["fr", "en"].map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setLang(c)}
                      data-testid={`settings-lang-${c}`}
                      className={[
                        "px-2.5 py-1 text-[11px] uppercase font-semibold rounded transition-all",
                        lang === c ? "bg-white text-[#0A2540] shadow-sm" : "text-[#6B7280]",
                      ].join(" ")}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </Row>
              <Row label={lang === "fr" ? "Notifications e-mail" : "Email notifications"}>
                <Switch defaultChecked data-testid="settings-email-toggle" />
              </Row>
              <Row label={lang === "fr" ? "Résumé IA hebdomadaire" : "Weekly AI digest"}>
                <Switch data-testid="settings-ai-toggle" />
              </Row>
              <Row label={lang === "fr" ? "Sauvegarde automatique" : "Auto backup"}>
                <Switch defaultChecked data-testid="settings-backup-toggle" />
              </Row>
            </div>
          </Section>
        </div>
      </div>
    </div>
  );
}

const Section = ({ title, children }) => (
  <section className="bg-white border border-[#E5E7EB] rounded-xl p-5 md:p-6">
    <h3 className="font-cabinet text-base font-semibold text-[#111827] tracking-tight mb-4">
      {title}
    </h3>
    {children}
  </section>
);

const Field = ({ label, value }) => (
  <label className="block">
    <span className="block text-[11px] uppercase font-semibold text-[#6B7280] tracking-wider mb-1.5">
      {label}
    </span>
    <input
      defaultValue={value}
      readOnly
      className="w-full bg-[#FAFAFA] border border-[#E5E7EB] rounded-lg px-3 py-2 text-sm text-[#111827] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0A2540]/15 focus:border-[#0A2540]/40 transition-all"
    />
  </label>
);

const Row = ({ label, children }) => (
  <div className="flex items-center justify-between py-2 border-b border-[#F3F4F6] last:border-0">
    <span className="text-sm text-[#111827]">{label}</span>
    {children}
  </div>
);
