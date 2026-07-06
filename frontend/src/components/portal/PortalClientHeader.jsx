import { Mail, MapPin, Phone } from "lucide-react";
import { getDisplayCompany, getDisplayName } from "@/utils/clientDisplay";

export default function PortalClientHeader({ client, artisan, t }) {
  const company = getDisplayCompany(client);
  const contact = getDisplayName(client);
  const location = [client.city, client.address].filter(Boolean).join(", ") || null;

  return (
    <div className="bg-white border border-[#E5E7EB] rounded-xl p-5 md:p-6">
      <p className="text-xs font-semibold uppercase tracking-wide text-[#9CA3AF] mb-2">
        {t("portal.providedBy")} {artisan.companyName}
      </p>
      <h1 className="font-cabinet text-2xl font-bold text-[#111827] tracking-tight">{company}</h1>
      {contact && contact !== company ? (
        <p className="text-sm text-[#4B5563] mt-1">{contact}</p>
      ) : null}
      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-4 text-sm text-[#4B5563]">
        {client.email ? (
          <span className="inline-flex items-center gap-1.5">
            <Mail className="w-3.5 h-3.5 shrink-0" />
            {client.email}
          </span>
        ) : null}
        {client.phone ? (
          <span className="inline-flex items-center gap-1.5">
            <Phone className="w-3.5 h-3.5 shrink-0" />
            {client.phone}
          </span>
        ) : null}
        {location ? (
          <span className="inline-flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 shrink-0" />
            {location}
          </span>
        ) : null}
      </div>
    </div>
  );
}
