import { ActionButton } from "@/components/dashboard/ActionButton";

export default function PageHeader({
  eyebrow,
  title,
  subtitle,
  trailing,
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
      className="flex flex-col md:flex-row md:items-end md:justify-between gap-5 mb-6 md:mb-8"
    >
      <div>
        {eyebrow && (
          <span className="dash-badge dash-badge-info mb-3">
            {eyebrow}
          </span>
        )}
        <h1 className="dash-display text-3xl md:text-[34px] leading-[1.1]">
          {title}
        </h1>
        {subtitle && (
          <p className="text-[14px] text-dash-text-muted mt-2.5 max-w-2xl leading-relaxed">
            {subtitle}
          </p>
        )}
      </div>
      {(primaryLabel || secondaryLabel || trailing) && (
        <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
          {trailing}
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
