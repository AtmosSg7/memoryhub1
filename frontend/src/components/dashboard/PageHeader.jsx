import { ActionButton } from "@/components/dashboard/ActionButton";

export default function PageHeader({
  eyebrow,
  title,
  subtitle,
  primaryLabel,
  primaryIcon: PrimaryIcon,
  onPrimary,
  secondaryLabel,
  secondaryIcon: SecondaryIcon,
  onSecondary,
  testId = "page-header",
}) {
  return (
    <div
      data-testid={testId}
      className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-6 md:mb-8"
    >
      <div>
        {eyebrow && (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-[#EFF6FF] text-[#0A2540] text-[10px] font-semibold uppercase tracking-widest mb-3">
            {eyebrow}
          </span>
        )}
        <h1 className="font-cabinet text-3xl md:text-[34px] font-bold text-[#111827] tracking-tight leading-[1.1]">
          {title}
        </h1>
        {subtitle && (
          <p className="text-[14px] text-[#4B5563] mt-2 max-w-2xl leading-relaxed">
            {subtitle}
          </p>
        )}
      </div>
      {(primaryLabel || secondaryLabel) && (
        <div className="flex items-center gap-2 shrink-0">
          {secondaryLabel && (
            <ActionButton
              variant="secondary"
              onClick={onSecondary}
              data-testid={`${testId}-secondary`}
            >
              {SecondaryIcon && <SecondaryIcon className="w-4 h-4" />}
              {secondaryLabel}
            </ActionButton>
          )}
          {primaryLabel && (
            <ActionButton
              variant="primary"
              onClick={onPrimary}
              data-testid={`${testId}-primary`}
            >
              {PrimaryIcon && <PrimaryIcon className="w-4 h-4" />}
              {primaryLabel}
            </ActionButton>
          )}
        </div>
      )}
    </div>
  );
}
