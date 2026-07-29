import { useEffect, useState } from "react";
import { fetchAdminErrors, fetchAdminSystemHealth } from "@/lib/adminApi";
import { AdminAlerts, AdminCard } from "@/layouts/AdminLayout";

export default function AdminSystemPage() {
  const [health, setHealth] = useState(null);
  const [errors, setErrors] = useState(null);

  useEffect(() => {
    fetchAdminSystemHealth().then(({ res, data }) => res.ok && setHealth(data));
    fetchAdminErrors("7d").then(({ res, data }) => res.ok && setErrors(data));
  }, []);

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-white">Santé système</h2>

      <div className="grid md:grid-cols-3 gap-4">
        <AdminCard title="MongoDB" value={health?.mongo === "ok" ? "OK" : "DOWN"} />
        <AdminCard title="Ready" value={health?.ready ? "Oui" : "Non"} />
        <AdminCard title="Emails en retry" value={health?.emailRetrying ?? 0} />
      </div>

      <section>
        <h3 className="text-sm text-slate-400 mb-2">Alertes</h3>
        <AdminAlerts alerts={health?.alerts} />
      </section>

      <section className="grid md:grid-cols-2 gap-4">
        <AdminCard title="Échecs imports (7j)" value={errors?.importFailuresCount ?? 0} />
        <AdminCard title="Échecs emails (7j)" value={errors?.emailFailuresCount ?? 0} />
      </section>

      {errors?.stripeWebhookFailures?.length ? (
        <div>
          <h3 className="text-sm text-slate-400 mb-2">Webhooks Stripe échoués</h3>
          <pre className="text-xs bg-slate-900 border border-slate-800 rounded-xl p-4 overflow-auto text-slate-300">
            {JSON.stringify(errors.stripeWebhookFailures, null, 2)}
          </pre>
        </div>
      ) : null}
    </div>
  );
}
