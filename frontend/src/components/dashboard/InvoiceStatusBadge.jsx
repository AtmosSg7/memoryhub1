import StatusBadge from "@/components/dashboard/StatusBadge";
import { getInvoiceDisplayStatus } from "@/utils/invoiceDisplay";

export default function InvoiceStatusBadge({ invoice, ...props }) {
  return <StatusBadge kind="invoice" status={getInvoiceDisplayStatus(invoice)} {...props} />;
}
