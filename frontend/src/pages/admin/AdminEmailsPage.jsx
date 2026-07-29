import { useEffect, useState } from "react";
import { fetchAdminEmails } from "@/lib/adminApi";
import { AdminCard, AdminPagination, AdminPeriodSelect, AdminTable } from "@/layouts/AdminLayout";

export default function AdminEmailsPage() {
  const [period, setPeriod] = useState("30d");
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);

  useEffect(() => {
    fetchAdminEmails({ period, page }).then(({ res, data: payload }) => {
      if (res.ok) setData(payload);
    });
  }, [period, page]);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold text-white">Emails transactionnels</h2>
        <AdminPeriodSelect value={period} onChange={setPeriod} />
      </div>
      <div className="grid grid-cols-3 gap-4">
        <AdminCard title="Total" value={data?.summary?.total} />
        <AdminCard title="Envoyés" value={data?.summary?.sent} />
        <AdminCard title="Échecs" value={data?.summary?.failed} />
      </div>
      <AdminTable
        columns={[
          { key: "templateKey", label: "Template" },
          { key: "to", label: "Destinataire" },
          { key: "status", label: "Statut" },
          { key: "attempts", label: "Tentatives" },
          { key: "createdAt", label: "Date" },
        ]}
        rows={data?.items}
      />
      <AdminPagination page={data?.page || 1} totalPages={data?.totalPages || 1} onPageChange={setPage} />
    </div>
  );
}
