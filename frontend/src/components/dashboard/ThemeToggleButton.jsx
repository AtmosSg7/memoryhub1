import { Moon, Sun } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useDashboardLang } from "@/hooks/useDashboardLang";
import { useDashboardTheme } from "@/context/DashboardThemeContext";

export default function ThemeToggleButton({ className = "" }) {
  const { t } = useDashboardLang();
  const { isDark, toggleLightDark } = useDashboardTheme();

  const label = isDark ? t("appearance.useLightTheme") : t("appearance.useDarkTheme");

  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={toggleLightDark}
            className={[
              "w-9 h-9 rounded-lg border border-dash-border bg-dash-surface-muted flex items-center justify-center",
              "text-dash-text-muted hover:text-dash-text hover:bg-dash-surface transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dash-primary/20",
              className,
            ].join(" ")}
            data-testid="topbar-theme-toggle"
            aria-label={label}
            title={label}
          >
            {isDark ? (
              <Sun className="w-4 h-4" aria-hidden="true" />
            ) : (
              <Moon className="w-4 h-4" aria-hidden="true" />
            )}
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          <p>{t("appearance.toggleTheme")}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
