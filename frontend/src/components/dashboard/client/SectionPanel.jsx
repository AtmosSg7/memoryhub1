import { CLIENT_PANEL_CLASS } from "@/components/dashboard/client/clientDetailLayout";

export default function SectionPanel({
  id,
  title,
  subtitle,
  children,
  testId,
  action,
  icon: Icon,
}) {
  return (
    <section
      id={id}
      data-testid={testId}
      className={CLIENT_PANEL_CLASS}
    >
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="min-w-0">
          <h3 className="font-cabinet text-lg font-bold text-dash-text tracking-tight flex items-center gap-2">
            {Icon ? <Icon className="w-4 h-4 text-dash-primary" /> : null}
            {title}
          </h3>
          {subtitle ? <p className="text-xs text-dash-text-muted mt-0.5">{subtitle}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
