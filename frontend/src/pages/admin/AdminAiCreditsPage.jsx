import { useEffect, useState } from "react";
import { adminSimulateCredits, fetchAdminAiUsage, fetchAdminCredits } from "@/lib/adminApi";
import { AdminCard, AdminPagination, AdminPeriodSelect, AdminTable } from "@/layouts/AdminLayout";
import { toast } from "sonner";

export default function AdminAiCreditsPage() {
  const [period, setPeriod] = useState("30d");
  const [page, setPage] = useState(1);
  const [aiData, setAiData] = useState(null);
  const [creditsData, setCreditsData] = useState(null);
  const [simAction, setSimAction] = useState("IMPORT_DOCUMENT");
  const [simCost, setSimCost] = useState(20);
  const [simResult, setSimResult] = useState(null);

  useEffect(() => {
    fetchAdminAiUsage({ period, page }).then(({ res, data }) => res.ok && setAiData(data));
    fetchAdminCredits({ period, page: 1 }).then(({ res, data }) => res.ok && setCreditsData(data));
  }, [period, page]);

  const runSimulation = async () => {
    const { res, data } = await adminSimulateCredits({
      actionKey: simAction,
      hypotheticalCost: simCost,
      period,
    });
    if (res.ok) setSimResult(data);
    else toast.error("Simulation échouée");
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold text-white">IA & crédits</h2>
        <AdminPeriodSelect value={period} onChange={setPeriod} />
      </div>

      <div className="grid md:grid-cols-4 gap-4">
        <AdminCard title="Événements IA" value={aiData?.summary?.events} />
        <AdminCard title="Tokens" value={aiData?.summary?.totalTokens} />
        <AdminCard title="Coût USD (connu)" value={aiData?.summary?.estimatedCostUsd} />
        <AdminCard title="Crédits débités" value={creditsData?.consumedInPeriod} />
      </div>

      <AdminCard title="Simulation crédits (non persistée)">
        <div className="flex flex-wrap gap-2 mt-2">
          <input
            value={simAction}
            onChange={(e) => setSimAction(e.target.value)}
            className="rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
          />
          <input
            type="number"
            value={simCost}
            onChange={(e) => setSimCost(Number(e.target.value))}
            className="rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm w-24"
          />
          <button type="button" onClick={runSimulation} className="px-3 py-2 rounded bg-indigo-600 text-sm text-white">
            Simuler
          </button>
        </div>
        {simResult ? (
          <p className="text-sm text-slate-300 mt-3">
            Actuel: {simResult.currentTotalDebits} → Hypothèse: {simResult.hypotheticalTotalDebits} (Δ {simResult.delta})
          </p>
        ) : null}
      </AdminCard>

      <AdminTable
        columns={[
          { key: "userId", label: "User" },
          { key: "actionKey", label: "Action" },
          { key: "model", label: "Modèle" },
          { key: "totalTokens", label: "Tokens" },
          { key: "estimatedCostUsd", label: "USD" },
          { key: "success", label: "OK", render: (r) => (r.success ? "✓" : "✗") },
          { key: "createdAt", label: "Date" },
        ]}
        rows={aiData?.items}
      />
      <AdminPagination page={aiData?.page || 1} totalPages={aiData?.totalPages || 1} onPageChange={setPage} />
    </div>
  );
}
