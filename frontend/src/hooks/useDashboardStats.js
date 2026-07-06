import { useMemo } from "react";
import { useClients } from "@/hooks/useClients";
import { useQuotes } from "@/hooks/useQuotes";
import { useInvoices } from "@/hooks/useInvoices";
import { useCatalog } from "@/hooks/useCatalog";
import {
  countPendingQuotes,
  countUnpaidInvoices,
  computeMonthlyRevenue,
  computeTopClients,
} from "@/utils/dashboardDisplay";
import { normalizeInvoiceStatus } from "@/utils/invoiceDisplay";

export function useDashboardStats() {
  const { total: clientsTotal, loading: clientsLoading } = useClients();
  const { quotes, loading: quotesLoading } = useQuotes("");
  const { invoices, loading: invoicesLoading } = useInvoices("");
  const { stats: catalogStats, loading: catalogLoading } = useCatalog("");

  const loading = clientsLoading || quotesLoading || invoicesLoading || catalogLoading;

  const kpis = useMemo(
    () => ({
      clientsTotal,
      pendingQuotes: countPendingQuotes(quotes),
      unpaidInvoices: countUnpaidInvoices(invoices),
      quotesTotal: quotes.length,
      invoicesTotal: invoices.filter(
        (inv) => normalizeInvoiceStatus(inv.status) !== "cancelled"
      ).length,
      monthlyRevenue: computeMonthlyRevenue(invoices),
    }),
    [clientsTotal, quotes, invoices]
  );

  const topClients = useMemo(() => computeTopClients(quotes, invoices), [quotes, invoices]);

  const topServices = catalogStats?.mostUsed || [];

  return { kpis, topClients, topServices, loading };
}
