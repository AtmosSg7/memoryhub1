import { NavLink, Outlet } from "react-router-dom";
import { Suspense } from "react";
import { Activity, Brain, CreditCard, FileUp, LayoutDashboard, Mail, Server, Users } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

const NAV = [
  { to: "/admin", end: true, label: "Vue d'ensemble", icon: LayoutDashboard },
  { to: "/admin/users", label: "Utilisateurs", icon: Users },
  { to: "/admin/subscriptions", label: "Abonnements", icon: CreditCard },
  { to: "/admin/ai", label: "IA & crédits", icon: Brain },
  { to: "/admin/imports", label: "Imports", icon: FileUp },
  { to: "/admin/emails", label: "Emails", icon: Mail },
  { to: "/admin/system", label: "Santé système", icon: Server },
];

export default function AdminLayout() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-satoshi">
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur sticky top-0 z-20">
        <div className="max-w-[1400px] mx-auto px-5 md:px-8 py-4 flex items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-wider text-indigo-400 font-medium">Basera Internal</p>
            <h1 className="text-lg font-semibold text-white">Admin Operations</h1>
          </div>
          <div className="text-right text-sm text-slate-400">
            <p>{user?.email}</p>
            <NavLink to="/dashboard" className="text-indigo-400 hover:text-indigo-300">
              Retour artisan
            </NavLink>
          </div>
        </div>
      </header>

      <div className="max-w-[1400px] mx-auto px-5 md:px-8 py-6 flex flex-col lg:flex-row gap-6">
        <nav className="lg:w-56 shrink-0">
          <ul className="flex lg:flex-col gap-1 overflow-x-auto pb-2 lg:pb-0">
            {NAV.map(({ to, end, label, icon: Icon }) => (
              <li key={to}>
                <NavLink
                  to={to}
                  end={end}
                  className={({ isActive }) =>
                    `flex items-center gap-2 px-3 py-2 rounded-lg text-sm whitespace-nowrap transition-colors ${
                      isActive
                        ? "bg-indigo-600/20 text-indigo-200 border border-indigo-500/30"
                        : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
                    }`
                  }
                >
                  <Icon className="w-4 h-4" />
                  {label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        <main className="flex-1 min-w-0">
          <Suspense
            fallback={
              <div className="flex items-center justify-center py-16 text-sm text-slate-400" role="status">
                Chargement…
              </div>
            }
          >
            <Outlet />
          </Suspense>
        </main>
      </div>
    </div>
  );
}

export function AdminCard({ title, value, hint, children }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
      {title ? <p className="text-xs uppercase tracking-wide text-slate-500 mb-1">{title}</p> : null}
      {value !== undefined ? <p className="text-2xl font-semibold text-white">{value}</p> : null}
      {hint ? <p className="text-xs text-slate-500 mt-1">{hint}</p> : null}
      {children}
    </div>
  );
}

export function AdminPeriodSelect({ value, onChange }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200"
    >
      <option value="today">Aujourd'hui</option>
      <option value="7d">7 jours</option>
      <option value="30d">30 jours</option>
    </select>
  );
}

export function AdminTable({ columns, rows, emptyLabel = "Aucune donnée" }) {
  if (!rows?.length) {
    return <p className="text-sm text-slate-500 py-8 text-center">{emptyLabel}</p>;
  }
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-800">
      <table className="w-full text-sm">
        <thead className="bg-slate-900 text-slate-400 text-left">
          <tr>
            {columns.map((col) => (
              <th key={col.key} className="px-4 py-3 font-medium">
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => (
            <tr key={row.id || idx} className="border-t border-slate-800 hover:bg-slate-900/50">
              {columns.map((col) => (
                <td key={col.key} className="px-4 py-3 text-slate-300">
                  {col.render ? col.render(row) : row[col.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function AdminAlerts({ alerts }) {
  if (!alerts?.length) {
    return (
      <div className="rounded-xl border border-emerald-900/40 bg-emerald-950/30 px-4 py-3 text-sm text-emerald-300 flex items-center gap-2">
        <Activity className="w-4 h-4" />
        Rien de critique à signaler.
      </div>
    );
  }
  return (
    <div className="space-y-2">
      {alerts.map((alert) => (
        <div
          key={alert.code}
          className={`rounded-xl px-4 py-3 text-sm border ${
            alert.severity === "high"
              ? "border-red-800 bg-red-950/40 text-red-200"
              : alert.severity === "medium"
                ? "border-amber-800 bg-amber-950/30 text-amber-200"
                : "border-slate-700 bg-slate-900 text-slate-300"
          }`}
        >
          {alert.message}
        </div>
      ))}
    </div>
  );
}

export function AdminPagination({ page, totalPages, onPageChange }) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-between pt-4 text-sm text-slate-400">
      <button
        type="button"
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
        className="px-3 py-1 rounded border border-slate-700 disabled:opacity-40"
      >
        Précédent
      </button>
      <span>
        Page {page} / {totalPages}
      </span>
      <button
        type="button"
        disabled={page >= totalPages}
        onClick={() => onPageChange(page + 1)}
        className="px-3 py-1 rounded border border-slate-700 disabled:opacity-40"
      >
        Suivant
      </button>
    </div>
  );
}
