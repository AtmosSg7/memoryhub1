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
      className="bg-white border border-[#E5E7EB] rounded-xl p-5 md:p-6"
    >
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h3 className="font-cabinet text-lg font-bold text-[#111827] tracking-tight flex items-center gap-2">
            {Icon ? <Icon className="w-4 h-4 text-[#0A2540]" /> : null}
            {title}
          </h3>
          {subtitle ? <p className="text-xs text-[#6B7280] mt-0.5">{subtitle}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
