import { useEffect, useState } from "react";
import { fetchAdminImports } from "@/lib/adminApi";
import { AdminCard, AdminPagination, AdminPeriodSelect, AdminTable } from "@/layouts/AdminLayout";

export default function AdminImportsPage() {
  const [period, setPeriod] = useState("30d");
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);

  useEffect(() => {
    fetchAdminImports({ period, page }).then(({ res, data: payload }) => {
      if (res.ok) setData(payload);
    });
  }, [period, page]);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold text-white">Imports IA</h2>
        <AdminPeriodSelect value={period} onChange={setPeriod} />
      </div>
      <div className="grid grid-cols-3 gap-4">
        <AdminCard title="Total" value={data?.summary?.total} />
        <AdminCard title="Confirmés" value={data?.summary?.completed} />
        <AdminCard title="Échecs" value={data?.summary?.failed} />
      </div>
      <AdminTable
        columns={[
          { key: "userId", label: "User" },
          { key: "status", label: "Statut" },
          { key: "detectedKind", label: "Type" },
          { key: "createdAt", label: "Date" },
          {
            key: "file",
            label: "Fichier",
            render: (row) => row.file?.name || "—",
          },
        ]}
        rows={data?.items}
      />
      <AdminPagination page={data?.page || 1} totalPages={data?.totalPages || 1} onPageChange={setPage} />
    </div>
  );
}
