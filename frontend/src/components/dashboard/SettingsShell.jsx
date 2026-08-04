import SettingsNav from "@/components/dashboard/SettingsNav";

export default function SettingsShell({ activeKey, children, testId = "settings-shell" }) {
  return (
    <div
      className="grid grid-cols-1 lg:grid-cols-[240px_minmax(0,1fr)] gap-6"
      data-testid={testId}
    >
      <aside className="rounded-2xl border border-dash-border bg-dash-surface p-3 h-fit dash-panel">
        <SettingsNav activeKey={activeKey} />
      </aside>
      <div className="space-y-4 min-w-0">{children}</div>
    </div>
  );
}

function SettingsSection({ title, children, testId }) {
  return (
    <section
      className="rounded-2xl border border-dash-border bg-dash-surface p-5 md:p-6 dash-panel"
      data-testid={testId}
    >
      {title ? (
        <h3 className="font-cabinet text-base font-semibold text-dash-text tracking-tight mb-4">{title}</h3>
      ) : null}
      {children}
    </section>
  );
}

SettingsShell.Section = SettingsSection;
