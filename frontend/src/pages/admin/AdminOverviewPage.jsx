import { useEffect, useState } from "react";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { fetchAdminOverview } from "@/lib/adminApi";
import { AdminAlerts, AdminCard, AdminPeriodSelect } from "@/layouts/AdminLayout";

export default function AdminOverviewPage() {
  const [period, setPeriod] = useState("30d");
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    fetchAdminOverview(period)
      .then(({ res, data: payload }) => {
        if (!active) return;
        if (!res.ok) {
          setError(payload?.detail?.message || payload?.message || "Erreur de chargement");
          setData(null);
          return;
        }
        setData(payload);
      })
      .catch(() => active && setError("Impossible de charger l'overview"))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [period]);

  const chartData = data
    ? [
        { label: "Actifs 7j", value: data.users?.activeLast7d || 0 },
        { label: "Actifs 30j", value: data.users?.activeLast30d || 0 },
        { label: "Nouveaux période", value: data.users?.newInPeriod || 0 },
      ]
    : [];

  const aiChartData = data
    ? [
        { label: "Période", credits: data.credits?.consumedInPeriod || 0, cost: data.aiUsage?.estimatedCostUsd || 0 },
        { label: "30j", credits: data.credits?.consumedLast30d || 0, cost: data.aiUsageLast30d?.estimatedCostUsd || 0 },
      ]
    : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-white">Vue d'ensemble</h2>
          <p className="text-sm text-slate-500">Indicateurs produit et opérationnels</p>
        </div>
        <AdminPeriodSelect value={period} onChange={setPeriod} />
      </div>

      {loading ? <p className="text-slate-400">Chargement…</p> : null}
      {error ? <p className="text-red-400">{error}</p> : null}

      {data ? (
        <>
          <section>
            <h3 className="text-sm font-medium text-slate-400 mb-3">À surveiller</h3>
            <AdminAlerts alerts={data.alerts} />
          </section>

          <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <AdminCard title="Utilisateurs" value={data.users?.total} hint={`+${data.users?.newInPeriod || 0} sur la période`} />
            <AdminCard title="Actifs (période)" value={data.users?.activeInPeriod} hint={`7j: ${data.users?.activeLast7d || 0}`} />
            <AdminCard title="Activés" value={data.users?.activated} hint="≥1 client + devis/facture/import" />
            <AdminCard
              title="MRR estimé"
              value={data.mrr?.source === "not_configured" ? "—" : `€${data.mrr?.amountEur ?? 0}`}
              hint={data.mrr?.disclaimer}
            />
          </section>

          <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <AdminCard title="Crédits consommés" value={data.credits?.consumedInPeriod} />
            <AdminCard
              title="Coût OpenAI (USD)"
              value={data.aiUsage?.estimatedCostUsd ?? 0}
              hint={
                data.aiUsage?.unknownCostEvents
                  ? `${data.aiUsage.unknownCostEvents} événement(s) sans tarif`
                  : "Tarifs modèles configurés"
              }
            />
            <AdminCard title="Imports réussis" value={data.imports?.completed} hint={`Échecs: ${data.imports?.failed || 0}`} />
            <AdminCard title="Emails envoyés" value={data.emails?.sent} hint={`Échecs: ${data.emails?.failed || 0}`} />
          </section>

          <section className="grid lg:grid-cols-2 gap-4">
            <AdminCard title="Utilisateurs actifs">
              <div className="h-48 mt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <XAxis dataKey="label" stroke="#64748b" fontSize={12} />
                    <YAxis stroke="#64748b" fontSize={12} />
                    <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid #334155" }} />
                    <Line type="monotone" dataKey="value" stroke="#818cf8" strokeWidth={2} dot />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </AdminCard>
            <AdminCard title="IA — crédits vs coût USD">
              <div className="h-48 mt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={aiChartData}>
                    <XAxis dataKey="label" stroke="#64748b" fontSize={12} />
                    <YAxis stroke="#64748b" fontSize={12} />
                    <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid #334155" }} />
                    <Line type="monotone" dataKey="credits" name="Crédits" stroke="#34d399" strokeWidth={2} />
                    <Line type="monotone" dataKey="cost" name="Coût USD" stroke="#fbbf24" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </AdminCard>
          </section>

          {data.grossAiMarginEstimate ? (
            <AdminCard
              title="Marge brute IA (estimation)"
              hint={data.grossAiMarginEstimate.disclaimer}
            >
              <p className="text-lg text-white mt-2">
                Revenus €{data.grossAiMarginEstimate.revenueEur} − coût IA ${data.grossAiMarginEstimate.aiCostUsd}
              </p>
            </AdminCard>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
