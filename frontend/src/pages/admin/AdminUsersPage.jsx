import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { fetchAdminUsers } from "@/lib/adminApi";
import { AdminPagination, AdminTable } from "@/layouts/AdminLayout";

export default function AdminUsersPage() {
  const [q, setQ] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetchAdminUsers({ q: search, page })
      .then(({ res, data: payload }) => {
        if (!active) return;
        if (!res.ok) {
          setError(payload?.detail?.message || "Erreur");
          return;
        }
        setData(payload);
        setError(null);
      })
      .catch(() => active && setError("Chargement impossible"))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [search, page]);

  const columns = [
    {
      key: "email",
      label: "Email",
      render: (row) => (
        <Link to={`/admin/users/${row.id}`} className="text-indigo-300 hover:underline">
          {row.email}
        </Link>
      ),
    },
    { key: "createdAt", label: "Inscription" },
    {
      key: "emailVerified",
      label: "Vérifié",
      render: (row) => (row.emailVerified ? "Oui" : "Non"),
    },
    { key: "planId", label: "Plan" },
    { key: "subscriptionStatus", label: "Abonnement" },
    { key: "clientsCount", label: "Clients" },
    { key: "importsCount", label: "Imports" },
    { key: "creditsAvailable", label: "Crédits" },
    { key: "accountStatus", label: "Compte" },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-white">Utilisateurs</h2>
          <p className="text-sm text-slate-500">{data?.total ?? 0} comptes</p>
        </div>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            setPage(1);
            setSearch(q.trim());
          }}
        >
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Rechercher par email"
            className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 min-w-[220px]"
          />
          <button type="submit" className="px-3 py-2 rounded-lg bg-indigo-600 text-sm text-white">
            Chercher
          </button>
        </form>
      </div>

      {loading ? <p className="text-slate-400">Chargement…</p> : null}
      {error ? <p className="text-red-400">{error}</p> : null}
      <AdminTable columns={columns} rows={data?.items} />
      <AdminPagination page={data?.page || 1} totalPages={data?.totalPages || 1} onPageChange={setPage} />
    </div>
  );
}
