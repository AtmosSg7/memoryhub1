import { useDashboardLang } from "@/hooks/useDashboardLang";

import PageHeader from "@/components/dashboard/PageHeader";

import ActivityFeed from "@/components/dashboard/ActivityFeed";



export default function TimelinePage() {

  const { t } = useDashboardLang();



  return (

    <div className="space-y-6" data-testid="timeline-page">

      <PageHeader

        title={t("page.timeline.title")}

        subtitle={t("page.timeline.subtitle")}

        testId="timeline-header"

      />



      <ActivityFeed limit={50} showViewAll={false} showEmptyState />

    </div>

  );

}

