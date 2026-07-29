import { Star } from "lucide-react";
import {
  formatLastInteraction,
  getClientColor,
  getClientInitials,
  getClientTags,
  getDisplayCompany,
  getDisplayName,
  getPrimaryEmail,
  getPrimaryPhone,
  isClientFavorite,
} from "@/utils/clientDisplay";
import {
  getClientDocumentsCount,
  getClientLastActivityAt,
  getClientNotesCount,
  getClientTotalRevenue,
  needsFollowUp,
} from "@/utils/clientList";
import { formatInvoiceAmount } from "@/utils/invoiceDisplay";

export default function ClientListCard({ client, lang, t, onClick }) {
  const initials = getClientInitials(client);
  const color = getClientColor(client.id);
  const name = getDisplayCompany(client) || getDisplayName(client);
  const phone = getPrimaryPhone(client);
  const email = getPrimaryEmail(client);
  const tags = getClientTags(client).slice(0, 4);
  const favorite = isClientFavorite(client);
  const followUp = needsFollowUp(client);
  const revenue = getClientTotalRevenue(client);
  const documentsCount = getClientDocumentsCount(client);
  const notesCount = getClientNotesCount(client);
  const lastActivity = formatLastInteraction(getClientLastActivityAt(client), lang);

  return (
    <button
      type="button"
      onClick={onClick}
      data-testid={`client-card-${client.id}`}
      className="group w-full text-left bg-white border border-[#E5E7EB] rounded-xl p-4 sm:p-5 hover:-translate-y-0.5 hover:shadow-[0_8px_24px_-16px_rgba(10,37,64,0.2)] hover:border-[#0A2540]/20 transition-all"
    >
      <div className="flex items-start gap-3">
        <div
          className="w-10 h-10 rounded-lg flex items-center justify-center text-xs font-semibold text-white shrink-0"
          style={{ backgroundColor: color }}
        >
          {initials}
        </div>

        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="font-medium text-[#111827] truncate">{name}</span>
                {favorite ? (
                  <Star
                    className="w-3.5 h-3.5 text-amber-500 fill-amber-500 shrink-0"
                    aria-label={t("page.clients.favorite")}
                    data-testid={`client-card-favorite-${client.id}`}
                  />
                ) : null}
              </div>
              {(phone || email) && (
                <div className="mt-0.5 text-[12px] text-[#6B7280] truncate">
                  {[phone, email].filter(Boolean).join(" · ")}
                </div>
              )}
            </div>

            {followUp ? (
              <span
                className="shrink-0 inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wide bg-orange-50 text-orange-700 border border-orange-200"
                data-testid={`client-card-follow-up-${client.id}`}
              >
                {t("page.clients.badge.followUp")}
              </span>
            ) : null}
          </div>

          {tags.length > 0 ? (
            <div className="flex flex-wrap gap-1" data-testid={`client-card-tags-${client.id}`}>
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex max-w-full truncate px-1.5 py-0.5 rounded text-[10px] font-medium bg-[#F3F4F6] text-[#4B5563]"
                >
                  {tag}
                </span>
              ))}
            </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-[#6B7280]">
            <span data-testid={`client-card-activity-${client.id}`}>
              {t("page.clients.meta.lastActivity")}: {lastActivity}
            </span>
            <span className="tabular-nums font-medium text-[#0A2540]" data-testid={`client-card-revenue-${client.id}`}>
              {formatInvoiceAmount(revenue, lang)}
            </span>
            <span data-testid={`client-card-docs-${client.id}`}>
              {t("page.clients.meta.documents").replace("{count}", String(documentsCount))}
            </span>
            <span data-testid={`client-card-notes-${client.id}`}>
              {t("page.clients.meta.notes").replace("{count}", String(notesCount))}
            </span>
          </div>
        </div>
      </div>
    </button>
  );
}
