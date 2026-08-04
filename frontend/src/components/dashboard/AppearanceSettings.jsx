import { Check, Monitor, Moon, Sun } from "lucide-react";
import { useDashboardLang } from "@/hooks/useDashboardLang";
import { useDashboardTheme } from "@/context/DashboardThemeContext";

const OPTIONS = [
  {
    id: "light",
    icon: Sun,
    labelKey: "appearance.light",
    descriptionKey: "appearance.lightDescription",
  },
  {
    id: "dark",
    icon: Moon,
    labelKey: "appearance.dark",
    descriptionKey: "appearance.darkDescription",
  },
  {
    id: "system",
    icon: Monitor,
    labelKey: "appearance.system",
    descriptionKey: "appearance.systemDescription",
  },
];

/** Fixed preview palette — never inherits the active dashboard theme. */
const PREVIEW = {
  light: {
    frame: "#E5E7EB",
    canvas: "#F9FAFB",
    sidebar: "#FFFFFF",
    sidebarBorder: "#F3F4F6",
    card: "#FFFFFF",
    cardBorder: "#E5E7EB",
    bar: "#D1D5DB",
  },
  dark: {
    frame: "rgba(255,255,255,0.12)",
    canvas: "#0f1115",
    sidebar: "#0c0e12",
    sidebarBorder: "rgba(255,255,255,0.08)",
    card: "#1c212b",
    cardBorder: "rgba(255,255,255,0.1)",
    bar: "#4b5563",
  },
};

export default function AppearanceSettings() {
  const { t } = useDashboardLang();
  const { theme, setTheme } = useDashboardTheme();

  return (
    <div className="space-y-4" data-testid="appearance-settings">
      <p className="text-sm text-dash-text-muted leading-relaxed">{t("appearance.description")}</p>
      <div
        className="grid grid-cols-1 sm:grid-cols-3 gap-3"
        role="radiogroup"
        aria-label={t("appearance.section")}
      >
        {OPTIONS.map(({ id, icon: Icon, labelKey, descriptionKey }) => {
          const active = theme === id;
          return (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={active}
              data-testid={`appearance-option-${id}`}
              onClick={() => setTheme(id)}
              className={[
                "relative flex flex-col items-start gap-3 rounded-xl border p-4 text-left transition-all",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dash-primary/25",
                active
                  ? "border-dash-primary bg-dash-surface-muted shadow-sm ring-1 ring-dash-primary/20"
                  : "border-dash-border bg-dash-surface hover:border-dash-primary/40 hover:bg-dash-surface-muted",
              ].join(" ")}
            >
              <div className="flex w-full items-center justify-between gap-2">
                <span
                  className={[
                    "inline-flex h-9 w-9 items-center justify-center rounded-lg border",
                    active
                      ? "border-dash-primary/30 bg-dash-primary/10 text-dash-primary"
                      : "border-dash-border bg-dash-surface-muted text-dash-text-muted",
                  ].join(" ")}
                  aria-hidden="true"
                >
                  <Icon className="h-4 w-4" />
                </span>
                {active ? (
                  <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-dash-primary text-white">
                    <Check className="h-3 w-3" aria-hidden="true" />
                  </span>
                ) : null}
              </div>
              <div>
                <p className="text-sm font-semibold text-dash-text">{t(labelKey)}</p>
                <p className="mt-1 text-xs text-dash-text-muted leading-relaxed">
                  {t(descriptionKey)}
                </p>
              </div>
              <ThemePreview variant={id} />
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ThemePreview({ variant }) {
  if (variant === "system") {
    return (
      <div
        className="mt-auto w-full overflow-hidden rounded-lg border"
        style={{ borderColor: PREVIEW.light.frame }}
        aria-hidden="true"
      >
        <div className="flex h-16">
          <PreviewPane colors={PREVIEW.light} className="w-1/2 border-r" borderColor={PREVIEW.light.frame} />
          <PreviewPane colors={PREVIEW.dark} className="w-1/2" />
        </div>
      </div>
    );
  }

  const colors = PREVIEW[variant] || PREVIEW.light;
  return (
    <div
      className="mt-auto w-full overflow-hidden rounded-lg border"
      style={{ borderColor: colors.frame }}
      aria-hidden="true"
    >
      <PreviewPane colors={colors} className="h-16 w-full" />
    </div>
  );
}

function PreviewPane({ colors, className = "", borderColor }) {
  return (
    <div
      className={`flex ${className}`}
      style={{
        backgroundColor: colors.canvas,
        borderColor: borderColor || "transparent",
      }}
    >
      <div
        className="w-1/3 border-r"
        style={{
          backgroundColor: colors.sidebar,
          borderColor: colors.sidebarBorder,
        }}
      />
      <div className="flex flex-1 flex-col gap-1.5 p-2">
        <div className="h-2 w-2/3 rounded" style={{ backgroundColor: colors.bar }} />
        <div
          className="h-6 flex-1 rounded border"
          style={{
            backgroundColor: colors.card,
            borderColor: colors.cardBorder,
          }}
        />
      </div>
    </div>
  );
}
