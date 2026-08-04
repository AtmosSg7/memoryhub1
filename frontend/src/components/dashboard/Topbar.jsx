import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, ChevronDown, Menu } from "lucide-react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useDashboardLang } from "@/hooks/useDashboardLang";
import { useAuth } from "@/context/AuthContext";
import { useSearchHistory } from "@/hooks/useSearchHistory";
import { SEARCH_MIN_CHARS } from "@/hooks/useSearch";
import SearchDropdown from "@/components/dashboard/SearchDropdown";
import SearchField from "@/components/dashboard/SearchField";
import MobileNavSheet from "@/components/dashboard/MobileNavSheet";
import CreditBalanceBadge from "@/components/dashboard/CreditBalanceBadge";
import BetaFeedbackDialog from "@/components/dashboard/BetaFeedbackDialog";
import ThemeToggleButton from "@/components/dashboard/ThemeToggleButton";
import { useIsShowcaseDemo } from "@/context/ShowcaseThemeIsolation";
import { LOGOUT } from "@/constants/testIds/auth";

export default function Topbar() {
  const { t, lang, setLang } = useDashboardLang();
  const { user, logout } = useAuth();
  const { addSearch } = useSearchHistory();
  const navigate = useNavigate();
  const isShowcase = useIsShowcaseDemo();
  const searchInputRef = useRef(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);

  const firstName = user?.firstName || "";
  const lastName = user?.lastName || "";
  const fullName = [firstName, lastName].filter(Boolean).join(" ") || user?.email || "—";
  const companyName = user?.companyName || "";
  const email = user?.email || "";
  const initials = [firstName?.[0], lastName?.[0]].filter(Boolean).join("").toUpperCase() || "MH";

  const goToSearchPage = useCallback(
    (query) => {
      const trimmed = (query || "").trim();
      if (trimmed.length < SEARCH_MIN_CHARS) return;
      addSearch(trimmed);
      setDropdownOpen(false);
      navigate(`/dashboard/search?q=${encodeURIComponent(trimmed)}`);
    },
    [addSearch, navigate]
  );

  useEffect(() => {
    const handleKeyDown = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchInputRef.current?.focus();
        setDropdownOpen(true);
      }
      if (event.key === "Escape") {
        setDropdownOpen(false);
        searchInputRef.current?.blur();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const handleSearchKeyDown = (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      goToSearchPage(searchQuery);
    }
  };

  const handleSearchChange = (event) => {
    const value = event.target.value;
    setSearchQuery(value);
    setDropdownOpen(value.trim().length >= SEARCH_MIN_CHARS);
  };

  return (
    <header
      className={[
        "z-30 h-16 dash-chrome",
        isShowcase ? "relative shrink-0" : "sticky top-0",
      ].join(" ")}
      data-testid="topbar-root"
    >
      <div className="h-full max-w-[1440px] mx-auto flex items-center gap-3 md:gap-4 px-5 md:px-8">
        <div className="md:hidden flex items-center gap-2">
          <button
            type="button"
            className="w-9 h-9 rounded-lg border border-dash-border flex items-center justify-center text-dash-text-muted hover:bg-dash-surface-muted transition-colors"
            data-testid="topbar-mobile-menu"
            aria-label={t("topbar.menu.mobileNav")}
            onClick={() => setMobileNavOpen(true)}
          >
            <Menu className="w-4 h-4" />
          </button>
          <MobileNavSheet open={mobileNavOpen} onOpenChange={setMobileNavOpen} />
          <div className="w-8 h-8 rounded-lg bg-[var(--dash-nav-active-bg)] dark:bg-dash-surface-elevated flex items-center justify-center">
            <span className="font-cabinet text-white text-sm font-bold">M</span>
          </div>
        </div>

        <div className="flex-1 max-w-xl relative">
          <SearchField
            ref={searchInputRef}
            value={searchQuery}
            onChange={handleSearchChange}
            onKeyDown={handleSearchKeyDown}
            onFocus={() => {
              if (searchQuery.trim().length >= SEARCH_MIN_CHARS) {
                setDropdownOpen(true);
              }
            }}
            placeholder={t("topbar.search.placeholder")}
            data-testid="topbar-search-input"
          />
          <SearchDropdown
            query={searchQuery}
            open={dropdownOpen}
            onClose={() => setDropdownOpen(false)}
            onNavigate={() => setSearchQuery("")}
          />
        </div>

        <div className="flex items-center gap-2 md:gap-3">
          <div
            className="flex items-center bg-dash-surface-muted rounded-lg p-0.5"
            data-testid="topbar-lang-toggle"
          >
            {["fr", "en"].map((code) => (
              <button
                key={code}
                onClick={() => setLang(code)}
                data-testid={`topbar-lang-${code}`}
                className={[
                  "px-2.5 py-1 text-[11px] uppercase font-semibold rounded transition-all tracking-wider",
                  lang === code
                    ? "bg-dash-surface text-dash-primary shadow-sm"
                    : "text-dash-text-muted hover:text-dash-text",
                ].join(" ")}
              >
                {code}
              </button>
            ))}
          </div>

          <CreditBalanceBadge className="hidden sm:inline-flex" />

          <ThemeToggleButton />

          <button
            type="button"
            className="relative w-9 h-9 rounded-lg border border-dash-border bg-dash-surface-muted flex items-center justify-center text-dash-text-subtle cursor-not-allowed"
            data-testid="topbar-notifications-btn"
            disabled
            aria-disabled="true"
            aria-label={t("topbar.notifications")}
            title={t("toast.comingSoon")}
          >
            <Bell className="w-4 h-4" />
          </button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="flex items-center gap-2 pl-1 pr-2 py-1 rounded-lg hover:bg-dash-surface-muted transition-colors"
                data-testid="topbar-profile-btn"
              >
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#0A2540] to-[#173A5E] dark:from-dash-accent/80 dark:to-dash-primary text-white flex items-center justify-center text-xs font-semibold">
                  {initials}
                </div>
                <div className="hidden lg:flex flex-col text-left leading-tight">
                  <span className="text-[13px] font-medium text-dash-text">
                    {fullName}
                  </span>
                  <span className="text-[11px] text-dash-text-muted">
                    {companyName}
                  </span>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-dash-text-subtle hidden lg:block" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <div className="flex flex-col">
                  <span className="text-sm font-semibold">{fullName}</span>
                  <span className="text-xs text-dash-text-muted font-normal">
                    {email}
                  </span>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                data-testid="profile-menu-account"
                onClick={() => navigate("/dashboard/settings")}
              >
                {t("topbar.menu.account")}
              </DropdownMenuItem>
              <DropdownMenuItem
                data-testid="profile-menu-billing"
                onClick={() => navigate("/dashboard/billing")}
              >
                {t("topbar.menu.billing")}
              </DropdownMenuItem>
              <DropdownMenuItem
                data-testid="profile-menu-feedback"
                onClick={() => setFeedbackOpen(true)}
              >
                {t("topbar.menu.feedback")}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                data-testid={LOGOUT.button}
                className="text-[color:var(--dash-danger-text)] focus:text-[color:var(--dash-danger-text)] focus:bg-[color:var(--dash-danger-bg)]"
                onClick={handleLogout}
              >
                {t("topbar.menu.logout")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      <BetaFeedbackDialog open={feedbackOpen} onOpenChange={setFeedbackOpen} />
    </header>
  );
}
