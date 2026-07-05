import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Bell, Plus, ChevronDown, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { useAddClient } from "@/context/AddClientContext";
import { useSearchHistory } from "@/hooks/useSearchHistory";
import { SEARCH_MIN_CHARS } from "@/hooks/useSearch";
import SearchDropdown from "@/components/dashboard/SearchDropdown";
import { toast } from "sonner";
import { LOGOUT } from "@/constants/testIds/auth";

export default function Topbar() {
  const { t, lang, setLang } = useDashboardLang();
  const { user, logout } = useAuth();
  const { openAddClient } = useAddClient();
  const { addSearch } = useSearchHistory();
  const navigate = useNavigate();
  const searchInputRef = useRef(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);

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
      className="sticky top-0 z-30 h-16 bg-white/85 backdrop-blur-md border-b border-[#E5E7EB]"
      data-testid="topbar-root"
    >
      <div className="h-full max-w-[1440px] mx-auto flex items-center gap-3 md:gap-4 px-5 md:px-8">
        <div className="md:hidden flex items-center gap-2">
          <button
            className="w-9 h-9 rounded-lg border border-[#E5E7EB] flex items-center justify-center text-[#4B5563]"
            data-testid="topbar-mobile-menu"
            aria-label="menu"
          >
            <Menu className="w-4 h-4" />
          </button>
          <div className="w-8 h-8 rounded-lg bg-[#0A2540] flex items-center justify-center">
            <span className="font-cabinet text-white text-sm font-bold">M</span>
          </div>
        </div>

        <div className="flex-1 max-w-xl">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA3AF]" />
            <input
              ref={searchInputRef}
              type="text"
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
              className="w-full bg-[#F9FAFB] border border-[#E5E7EB] rounded-lg pl-10 pr-14 py-2.5 text-sm placeholder:text-[#9CA3AF] text-[#111827] focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#0A2540]/15 focus:border-[#0A2540]/40 transition-all"
              autoComplete="off"
            />
            <kbd className="hidden md:inline-flex absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] px-1.5 py-0.5 rounded border border-[#E5E7EB] text-[#6B7280] bg-white">
              ⌘K
            </kbd>
            <SearchDropdown
              query={searchQuery}
              open={dropdownOpen}
              onClose={() => setDropdownOpen(false)}
              onNavigate={() => setSearchQuery("")}
            />
          </div>
        </div>

        <div className="flex items-center gap-2 md:gap-3">
          <div
            className="hidden sm:flex items-center bg-[#F3F4F6] rounded-md p-0.5"
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
                    ? "bg-white text-[#0A2540] shadow-sm"
                    : "text-[#6B7280] hover:text-[#111827]",
                ].join(" ")}
              >
                {code}
              </button>
            ))}
          </div>

          <button
            className="relative w-9 h-9 rounded-lg border border-[#E5E7EB] hover:bg-[#F9FAFB] flex items-center justify-center text-[#4B5563] transition-colors"
            data-testid="topbar-notifications-btn"
            onClick={() => toast.message(t("topbar.notifications"), { description: t("toast.mockOnly") })}
            aria-label={t("topbar.notifications")}
          >
            <Bell className="w-4 h-4" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#0066FF] ring-2 ring-white" />
          </button>

          <Button
            data-testid="topbar-add-client-btn"
            onClick={openAddClient}
            className="hidden sm:inline-flex bg-[#0A2540] hover:bg-[#173A5E] text-white text-sm rounded-lg h-9 px-3.5 gap-2 shadow-sm"
          >
            <Plus className="w-4 h-4" />
            {t("topbar.addClient")}
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="flex items-center gap-2 pl-1 pr-2 py-1 rounded-lg hover:bg-[#F3F4F6] transition-colors"
                data-testid="topbar-profile-btn"
              >
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#0A2540] to-[#173A5E] text-white flex items-center justify-center text-xs font-semibold">
                  {initials}
                </div>
                <div className="hidden lg:flex flex-col text-left leading-tight">
                  <span className="text-[13px] font-medium text-[#111827]">
                    {fullName}
                  </span>
                  <span className="text-[11px] text-[#6B7280]">
                    {companyName}
                  </span>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-[#9CA3AF] hidden lg:block" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <div className="flex flex-col">
                  <span className="text-sm font-semibold">{fullName}</span>
                  <span className="text-xs text-[#6B7280] font-normal">
                    {email}
                  </span>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                data-testid="profile-menu-account"
                onClick={() => navigate("/profile")}
              >
                {t("topbar.menu.account")}
              </DropdownMenuItem>
              <DropdownMenuItem
                data-testid="profile-menu-settings"
                onClick={() => navigate("/dashboard/settings")}
              >
                {t("nav.settings")}
              </DropdownMenuItem>
              <DropdownMenuItem
                data-testid="profile-menu-billing"
                onClick={() => navigate("/billing")}
              >
                {t("topbar.menu.billing")}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                data-testid={LOGOUT.button}
                className="text-[#991B1B]"
                onClick={handleLogout}
              >
                {t("topbar.menu.logout")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
