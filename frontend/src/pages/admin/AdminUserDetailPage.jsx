import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { toast } from "sonner";
import {
  adminGrantCredits,
  adminResendVerification,
  adminResumeUser,
  adminSuspendUser,
  fetchAdminUserDetail,
} from "@/lib/adminApi";
import { AdminCard, AdminTable } from "@/layouts/AdminLayout";

export default function AdminUserDetailPage() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [credits, setCredits] = useState(50);
  const [reason, setReason] = useState("");
  const [suspendReason, setSuspendReason] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    fetchAdminUserDetail(id)
      .then(({ res, data: payload }) => {
        if (res.ok) setData(payload);
        else toast.error("Utilisateur introuvable");
      })
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const user = data?.user;

  const runAction = async (fn, successMsg) => {
    const { res, data: payload } = await fn();
    if (res.ok) {
      toast.success(successMsg);
      load();
    } else {
      toast.error(payload?.detail?.message || payload?.message || "Action échouée");
    }
  };

  if (loading) return <p className="text-slate-400">Chargement…</p>;
  if (!user) return <p className="text-red-400">Utilisateur introuvable</p>;

  return (
    <div className="space-y-6">
      <div>
        <Link to="/admin/users" className="text-sm text-indigo-400 hover:underline">
          ← Utilisateurs
        </Link>
        <h2 className="text-xl font-semibold text-white mt-2">{user.email}</h2>
        <p className="text-sm text-slate-500">
          {user.firstName} {user.lastName} — {user.companyName}
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <AdminCard title="Statut compte" value={user.accountStatus || "active"} />
        <AdminCard title="Email vérifié" value={user.emailVerified ? "Oui" : "Non"} />
        <AdminCard
          title="Crédits restants"
          value={data.credits?.totalRemaining ?? "—"}
        />
      </div>

      <AdminCard title="Abonnement">
        <pre className="text-xs text-slate-400 mt-2 overflow-auto">
          {JSON.stringify(data.subscription, null, 2)}
        </pre>
      </AdminCard>

      <section className="grid md:grid-cols-2 gap-4">
        <AdminCard title="Accorder des crédits">
          <div className="space-y-2 mt-2">
            <input
              type="number"
              min={1}
              value={credits}
              onChange={(e) => setCredits(Number(e.target.value))}
              className="w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
            />
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Raison obligatoire"
              className="w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm min-h-[80px]"
            />
            <button
              type="button"
              className="px-3 py-2 rounded bg-indigo-600 text-sm text-white"
              onClick={() =>
                runAction(
                  () => adminGrantCredits(id, { credits, reason }),
                  "Crédits accordés"
                )
              }
            >
              Accorder
            </button>
          </div>
        </AdminCard>

        <AdminCard title="Actions compte">
          <div className="space-y-2 mt-2">
            {!user.emailVerified ? (
              <button
                type="button"
                className="w-full px-3 py-2 rounded border border-slate-600 text-sm"
                onClick={() => runAction(() => adminResendVerification(id), "Email envoyé")}
              >
                Renvoyer vérification email
              </button>
            ) : null}
            {user.accountStatus === "suspended" ? (
              <button
                type="button"
                className="w-full px-3 py-2 rounded bg-emerald-700 text-sm text-white"
                onClick={() => runAction(() => adminResumeUser(id), "Compte réactivé")}
              >
                Réactiver le compte
              </button>
            ) : (
              <>
                <textarea
                  value={suspendReason}
                  onChange={(e) => setSuspendReason(e.target.value)}
                  placeholder="Raison suspension"
                  className="w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm min-h-[60px]"
                />
                <button
                  type="button"
                  className="w-full px-3 py-2 rounded bg-red-800 text-sm text-white"
                  onClick={() =>
                    runAction(
                      () => adminSuspendUser(id, suspendReason),
                      "Compte suspendu"
                    )
                  }
                >
                  Suspendre le compte
                </button>
              </>
            )}
          </div>
        </AdminCard>
      </section>

      <div>
        <h3 className="text-sm text-slate-400 mb-2">Derniers imports</h3>
        <AdminTable
          columns={[
            { key: "id", label: "ID" },
            { key: "status", label: "Statut" },
            { key: "detectedKind", label: "Type" },
            { key: "createdAt", label: "Date" },
          ]}
          rows={data.recentImports}
        />
      </div>

      <div>
        <h3 className="text-sm text-slate-400 mb-2">Emails échoués</h3>
        <AdminTable
          columns={[
            { key: "templateKey", label: "Template" },
            { key: "to", label: "Destinataire" },
            { key: "lastError", label: "Erreur" },
            { key: "createdAt", label: "Date" },
          ]}
          rows={data.failedEmails}
        />
      </div>
    </div>
  );
}
