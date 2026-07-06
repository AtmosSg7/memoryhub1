import { FileText, Receipt, TrendingUp, AlertCircle } from "lucide-react";
import StatCard from "@/components/dashboard/StatCard";
import { formatInvoiceAmount } from "@/utils/invoiceDisplay";

export default function ClientCommercialSummary({ stats, lang, t }) {
  const cards = [
    {
      key: "revenue",
      label: t("clientDetail.revenue"),
      value: formatInvoiceAmount(stats.revenue, lang),
      icon: TrendingUp,
      testId: "client-stat-revenue",
    },
    {
      key: "quotes",
      label: t("nav.quotes"),
      value: stats.quotesCount,
      icon: FileText,
      testId: "client-stat-quotes",
    },
    {
      key: "invoices",
      label: t("nav.invoices"),
      value: stats.invoicesCount,
      icon: Receipt,
      testId: "client-stat-invoices",
    },
    {
      key: "unpaid",
      label: t("clientDetail.unpaid"),
      value: stats.unpaidCount,
      helper: stats.unpaidCount > 0 ? formatInvoiceAmount(stats.unpaidAmount, lang) : undefined,
      icon: AlertCircle,
      testId: "client-stat-unpaid",
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3" data-testid="client-commercial-summary">
      {cards.map((card) => (
        <StatCard
          key={card.key}
          label={card.label}
          value={card.value}
          helper={card.helper}
          icon={card.icon}
          secondary
          testId={card.testId}
        />
      ))}
    </div>
  );
}
