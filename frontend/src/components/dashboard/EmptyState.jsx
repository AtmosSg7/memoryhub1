import { ActionButton } from "@/components/dashboard/ActionButton";

export default function EmptyState({
  icon: Icon,
  title,
  description,
  cta,
  onCta,
  testId,
  compact = false,
  ctaVariant = "primary",
}) {
  return (
    <div
      data-testid={testId}
      className={[
        "flex flex-col items-center justify-center text-center border border-dashed border-[#E7E9EE] rounded-xl bg-[#F9FAFB]",
        compact ? "py-8 px-4" : "py-14 px-6",
      ].join(" ")}
    >
      <div className="w-12 h-12 rounded-full bg-white border border-[#E5E7EB] flex items-center justify-center text-[#9CA3AF] mb-4 shadow-sm">
        {Icon && <Icon className="w-5 h-5" strokeWidth={1.75} />}
      </div>
      <h4 className="font-cabinet text-[17px] font-semibold text-[#111827] tracking-tight">
        {title}
      </h4>
      {description && (
        <p className="text-[13px] text-[#4B5563] mt-1.5 max-w-sm leading-relaxed">
          {description}
        </p>
      )}
      {cta && onCta && (
        <ActionButton
          variant={ctaVariant}
          onClick={onCta}
          data-testid={`${testId}-cta`}
          className="mt-5"
        >
          {cta}
        </ActionButton>
      )}
    </div>
  );
}
