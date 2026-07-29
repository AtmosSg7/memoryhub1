import SettingsNav from "@/components/dashboard/SettingsNav";

export default function SettingsShell({ activeKey, children, testId = "settings-shell" }) {
  return (
    <div
      className="grid grid-cols-1 lg:grid-cols-[240px_minmax(0,1fr)] gap-6"
      data-testid={testId}
    >
      <aside className="rounded-2xl border border-[#E5E7EB] bg-white p-3 h-fit shadow-[0_1px_2px_rgba(17,24,39,0.04)]">
        <SettingsNav activeKey={activeKey} />
      </aside>
      <div className="space-y-4 min-w-0">{children}</div>
    </div>
  );
}

function SettingsSection({ title, children, testId }) {
  return (
    <section
      className="rounded-2xl border border-[#E5E7EB] bg-white p-5 md:p-6 shadow-[0_1px_2px_rgba(17,24,39,0.04)]"
      data-testid={testId}
    >
      {title ? (
        <h3 className="font-cabinet text-base font-semibold text-[#111827] tracking-tight mb-4">{title}</h3>
      ) : null}
      {children}
    </section>
  );
}

SettingsShell.Section = SettingsSection;
