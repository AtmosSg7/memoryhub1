import { useEffect, useState } from "react";
import { fetchAdminSubscriptions } from "@/lib/adminApi";
import { AdminPagination, AdminTable } from "@/layouts/AdminLayout";

export default function AdminSubscriptionsPage() {
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);

  useEffect(() => {
    fetchAdminSubscriptions({ page }).then(({ res, data: payload }) => {
      if (res.ok) setData(payload);
    });
  }, [page]);

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold text-white">Abonnements</h2>
      <AdminTable
        columns={[
          { key: "userEmail", label: "Email" },
          { key: "planId", label: "Plan" },
          { key: "status", label: "Statut" },
          { key: "currentPeriodEnd", label: "Fin période" },
          { key: "createdAt", label: "Créé" },
        ]}
        rows={data?.items}
      />
      <AdminPagination page={data?.page || 1} totalPages={data?.totalPages || 1} onPageChange={setPage} />
    </div>
  );
}
