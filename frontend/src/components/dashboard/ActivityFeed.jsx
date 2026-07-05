import { FileText, FolderClosed, Receipt, StickyNote, User, Mail, Loader2 } from "lucide-react";

import { useNavigate } from "react-router-dom";

import { useDashboardLang } from "@/hooks/useDashboardLang";

import { useRecentActivity } from "@/hooks/useRecentActivity";

import EmptyState from "@/components/dashboard/EmptyState";

import { Clock3 } from "lucide-react";

import {

  getEventDetail,

  getEventIconType,

  getEventLabelKey,

  formatEventTime,

} from "@/utils/eventDisplay";



const ICONS = {

  quote: { Icon: FileText, bg: "bg-[#EFF6FF]", color: "text-[#0A2540]" },

  invoice: { Icon: Receipt, bg: "bg-[#ECFDF5]", color: "text-[#065F46]" },

  note: { Icon: StickyNote, bg: "bg-[#FFFBEB]", color: "text-[#92400E]" },

  client: { Icon: User, bg: "bg-[#F3F4F6]", color: "text-[#4B5563]" },

  document: { Icon: FolderClosed, bg: "bg-[#EFF6FF]", color: "text-[#0A2540]" },

  email: { Icon: Mail, bg: "bg-[#EFF6FF]", color: "text-[#0066FF]" },

};



export default function ActivityFeed({

  limit = 10,

  showViewAll = true,

  showHeader = true,

  showEmptyState = false,

}) {

  const { t, lang } = useDashboardLang();

  const navigate = useNavigate();

  const { events, loading, error } = useRecentActivity(limit);



  const showEmpty = showEmptyState && !loading && !error && events.length === 0;



  return (

    <>

      <section

        data-testid="activity-feed-section"

        className="bg-white border border-[#E5E7EB] rounded-xl p-5 md:p-6"

      >

        {showHeader && (

          <div className="flex items-start justify-between mb-5">

            <div>

              <h3 className="font-cabinet text-lg font-bold text-[#111827] tracking-tight">

                {t("activity.title")}

              </h3>

              <p className="text-xs text-[#6B7280] mt-0.5">

                {t("activity.subtitle")}

              </p>

            </div>

            {showViewAll && (

              <button

                type="button"

                data-testid="activity-feed-view-all"

                onClick={() => navigate("/dashboard/timeline")}

                className="text-xs font-medium text-[#0A2540] hover:text-[#173A5E]"

              >

                {t("activity.viewAll")}

              </button>

            )}

          </div>

        )}



        {loading ? (

          <div className="flex items-center justify-center py-8 text-[#6B7280]">

            <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" />

          </div>

        ) : error ? (

          <p className="text-sm text-[#991B1B] py-4">{error}</p>

        ) : events.length === 0 && !showEmptyState ? (

          <p className="text-sm text-[#6B7280] py-4">{t("empty.noActivity.desc")}</p>

        ) : events.length > 0 ? (

          <ul className="relative space-y-4">

            <div className="absolute left-4 top-2 bottom-2 w-px bg-[#F3F4F6]" />



            {events.map((event) => {

              const iconType = getEventIconType(event.type);

              const meta = ICONS[iconType] ?? ICONS.client;

              return (

                <li

                  key={event.id}

                  data-testid={`activity-item-${event.id}`}

                  className="relative flex gap-3 pl-0"

                >

                  <div

                    className={[

                      "relative z-10 w-8 h-8 rounded-lg flex items-center justify-center border border-[#E5E7EB] bg-white shadow-sm shrink-0",

                    ].join(" ")}

                  >

                    <div

                      className={[

                        "w-6 h-6 rounded-md flex items-center justify-center",

                        meta.bg,

                        meta.color,

                      ].join(" ")}

                    >

                      <meta.Icon className="w-3.5 h-3.5" strokeWidth={2} />

                    </div>

                  </div>

                  <div className="flex-1 min-w-0 pt-0.5">

                    <div className="flex items-center justify-between gap-2">

                      <span className="text-[13px] font-medium text-[#111827]">

                        {t(getEventLabelKey(event.type))}

                      </span>

                      <span className="text-[11px] text-[#9CA3AF] shrink-0">

                        {formatEventTime(event.createdAt, lang)}

                      </span>

                    </div>

                    <p className="text-[12.5px] text-[#4B5563] mt-0.5 leading-snug truncate">

                      {getEventDetail(event, lang)}

                    </p>

                  </div>

                </li>

              );

            })}

          </ul>

        ) : null}

      </section>



      {showEmpty && (

        <EmptyState

          icon={Clock3}

          title={t("empty.noActivity.title")}

          description={t("empty.noActivity.desc")}

          cta={t("empty.noActivity.cta")}

          testId="empty-activity"

          compact

        />

      )}

    </>

  );

}

