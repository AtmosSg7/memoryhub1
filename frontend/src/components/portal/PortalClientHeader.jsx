import { UserRound } from "lucide-react";
import { getDisplayCompany, getDisplayName } from "@/utils/clientDisplay";

export default function PortalClientHeader({ client, artisan, t }) {
  const company = getDisplayCompany(client);
  const contact = getDisplayName(client);

  return (
    <div className="relative overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white p-5 md:p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
      <div className="absolute inset-y-0 left-0 w-1 bg-[#0A2540]/80" aria-hidden="true" />
      <div className="pl-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#9CA3AF] mb-2">
          {t("portal.welcomeLabel")}
        </p>
        <h2 className="font-cabinet text-2xl md:text-[1.75rem] font-bold text-[#111827] tracking-tight leading-tight">
          {company}
        </h2>
        {contact && contact !== company ? (
          <p className="text-sm text-[#4B5563] mt-1">{contact}</p>
        ) : null}
        <p className="text-sm text-[#6B7280] mt-3 leading-relaxed max-w-prose">
          {t("portal.welcomeDesc").replace("{artisan}", artisan.companyName)}
        </p>
        {artisan.contactName ? (
          <p className="inline-flex items-center gap-1.5 text-xs text-[#6B7280] mt-3 px-2.5 py-1 rounded-full bg-[#F9FAFB] border border-[#F3F4F6]">
            <UserRound className="w-3.5 h-3.5 shrink-0 text-[#9CA3AF]" aria-hidden="true" />
            {t("portal.artisanContact")} <span className="font-medium text-[#374151]">{artisan.contactName}</span>
          </p>
        ) : null}
      </div>
    </div>
  );
}
