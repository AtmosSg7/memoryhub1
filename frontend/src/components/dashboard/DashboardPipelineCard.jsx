import { memo, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useDashboardLang } from "@/hooks/useDashboardLang";
import { commercialDocumentsPath } from "@/utils/commercialDocumentsPath";

function PipelineBar({ label, count, max, tone, onClick, testId }) {
  const width = max > 0 ? Math.max(count > 0 ? 8 : 0, Math.round((count / max) * 100)) : 0;
  const tones = {
    navy: "bg-[var(--dash-nav-active-bg)]",
    blue: "bg-[#3B82F6]",
    green: "bg-[#059669]",
    red: "bg-[#DC2626]",
    amber: "bg-[#D97706]",
    slate: "bg-[#94A3B8]",
  };

  return (
    <button
      type="button"
      onClick={onClick}
      data-testid={testId}
      className="w-full text-left group rounded-lg px-1 py-1.5 hover:bg-dash-surface-muted transition-colors"
    >
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <span className="text-xs text-dash-text-muted group-hover:text-dash-text">{label}</span>
        <span className="text-xs font-semibold tabular-nums text-dash-text">{count}</span>
      </div>
      <div className="h-1.5 rounded-full bg-dash-surface-muted overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${tones[tone] || tones.navy}`}
          style={{ width: `${width}%` }}
        />
      </div>
    </button>
  );
}

function PipelineGroup({ title, items }) {
  const max = Math.max(...items.map((item) => item.count), 1);
  return (
    <div className="space-y-1">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-dash-text-subtle px-1 mb-2">
        {title}
      </p>
      {items.map((item) => (
        <PipelineBar key={item.id} {...item} max={max} />
      ))}
    </div>
  );
}

function DashboardPipelineCard({ pipeline, loading, periodMeta }) {
  const { t } = useDashboardLang();
  const navigate = useNavigate();
  const periodArgs = useMemo(
    () => (periodMeta?.from && periodMeta?.to ? { from: periodMeta.from, to: periodMeta.to } : {}),
    [periodMeta]
  );

  const quoteItems = useMemo(() => {
    const q = pipeline?.quotes || {};
    return [
      {
        id: "draft",
        label: t("dashboardV2.pipeline.quotes.draft"),
        count: q.draft || 0,
        tone: "slate",
        onClick: () =>
          navigate(commercialDocumentsPath({ kind: "quote", status: "draft", ...periodArgs })),
        testId: "pipeline-quote-draft",
      },
      {
        id: "sent",
        label: t("dashboardV2.pipeline.quotes.sent"),
        count: q.sent || 0,
        tone: "blue",
        onClick: () =>
          navigate(commercialDocumentsPath({ kind: "quote", status: "sent", ...periodArgs })),
        testId: "pipeline-quote-sent",
      },
      {
        id: "accepted",
        label: t("dashboardV2.pipeline.quotes.accepted"),
        count: q.accepted || 0,
        tone: "green",
        onClick: () =>
          navigate(commercialDocumentsPath({ kind: "quote", status: "accepted", ...periodArgs })),
        testId: "pipeline-quote-accepted",
      },
      {
        id: "rejected",
        label: t("dashboardV2.pipeline.quotes.rejected"),
        count: q.rejected || 0,
        tone: "red",
        onClick: () =>
          navigate(commercialDocumentsPath({ kind: "quote", status: "rejected", ...periodArgs })),
        testId: "pipeline-quote-rejected",
      },
    ];
  }, [pipeline, navigate, t, periodArgs]);

  const invoiceItems = useMemo(() => {
    const inv = pipeline?.invoices || {};
    return [
      {
        id: "pending",
        label: t("dashboardV2.pipeline.invoices.pending"),
        count: inv.pending || 0,
        tone: "amber",
        onClick: () =>
          navigate(
            commercialDocumentsPath({ kind: "invoice", status: "in_progress", ...periodArgs })
          ),
        testId: "pipeline-invoice-pending",
      },
      {
        id: "paid",
        label: t("dashboardV2.pipeline.invoices.paid"),
        count: inv.paid || 0,
        tone: "green",
        onClick: () =>
          navigate(commercialDocumentsPath({ kind: "invoice", status: "paid", ...periodArgs })),
        testId: "pipeline-invoice-paid",
      },
      {
        id: "overdue",
        label: t("dashboardV2.pipeline.invoices.overdue"),
        count: inv.overdue || 0,
        tone: "red",
        onClick: () =>
          navigate(commercialDocumentsPath({ kind: "invoice", status: "overdue", ...periodArgs })),
        testId: "pipeline-invoice-overdue",
      },
    ];
  }, [pipeline, navigate, t, periodArgs]);

  return (
    <section
      className="h-full rounded-xl border border-dash-border bg-dash-surface p-4 md:p-5 shadow-[0_1px_2px_rgba(10,37,64,0.04)]"
      data-testid="dashboard-pipeline"
    >
      <div className="mb-4">
        <h2 className="font-cabinet text-base md:text-lg font-bold text-dash-text tracking-tight">
          {t("dashboardV2.pipeline.title")}
        </h2>
        <p className="text-xs text-dash-text-muted mt-0.5">{t("dashboardV2.pipeline.subtitle")}</p>
      </div>

      {loading ? (
        <div className="space-y-3 animate-pulse" aria-hidden>
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-8 rounded-lg bg-dash-surface-muted" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <PipelineGroup title={t("dashboardV2.pipeline.quotesTitle")} items={quoteItems} />
          <PipelineGroup title={t("dashboardV2.pipeline.invoicesTitle")} items={invoiceItems} />
        </div>
      )}
    </section>
  );
}

export default memo(DashboardPipelineCard);
