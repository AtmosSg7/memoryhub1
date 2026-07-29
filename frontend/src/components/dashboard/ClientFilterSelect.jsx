import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { useDashboardLang } from "@/hooks/useDashboardLang";
import { getDisplayCompany } from "@/utils/clientDisplay";
import { FORM_FIELD_CLASS, FORM_SELECT_CONTENT_CLASS } from "@/components/dashboard/detailModalLayout";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function ClientFilterSelect({
  clients,
  value,
  onChange,
  allLabel,
  disabled = false,
  className = "w-full lg:w-56",
  testId = "client-filter",
}) {
  const { t, lang } = useDashboardLang();
  const [query, setQuery] = useState("");

  const sorted = useMemo(
    () =>
      [...clients].sort((a, b) =>
        getDisplayCompany(a).localeCompare(getDisplayCompany(b), lang === "fr" ? "fr" : "en")
      ),
    [clients, lang]
  );

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return sorted;
    return sorted.filter((client) => {
      const haystack = [
        client.name,
        client.company,
        client.contactName,
        client.email,
        client.city,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(term);
    });
  }, [sorted, query]);

  return (
    <div className={className} data-testid={testId}>
      <div className="relative mb-2">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#9CA3AF]" aria-hidden="true" />
        <Input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("page.clients.searchPlaceholder")}
          className="pl-8 h-8 text-sm rounded-lg border-[#E5E7EB]"
          data-testid={`${testId}-search`}
        />
      </div>
      <Select
        value={value || "all"}
        onValueChange={(next) => onChange(next === "all" ? "" : next)}
        disabled={disabled}
      >
        <SelectTrigger className={`${FORM_FIELD_CLASS} h-9 text-sm`} data-testid={`${testId}-select`}>
          <SelectValue placeholder={allLabel || t("communications.allClients")} />
        </SelectTrigger>
        <SelectContent className={FORM_SELECT_CONTENT_CLASS}>
          <SelectItem value="all">{allLabel || t("communications.allClients")}</SelectItem>
          {filtered.map((client) => (
            <SelectItem key={client.id} value={client.id}>
              {getDisplayCompany(client)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
