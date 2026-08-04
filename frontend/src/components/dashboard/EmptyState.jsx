import { ActionButton } from "@/components/dashboard/ActionButton";

export default function EmptyState({
  icon: Icon,
  title,
  description,
  cta,
  onCta,
  secondaryCta,
  onSecondaryCta,
  testId,
  compact = false,
  inline = false,
  ctaVariant = "primary",
  secondaryCtaVariant = "secondary",
}) {
  const titleId = testId ? `${testId}-title` : undefined;

  return (
    <div
      data-testid={testId}
      role="region"
      aria-labelledby={titleId}
      className={
        inline
          ? "flex flex-col items-center justify-center text-center py-8 px-4"
          : [
              "flex flex-col items-center justify-center text-center border border-dashed border-dash-border rounded-xl bg-dash-bg",
              compact ? "py-8 px-4" : "py-14 px-6",
            ].join(" ")
      }
    >
      {Icon ? (
        <div
          aria-hidden="true"
          className={[
            "rounded-full bg-dash-surface border border-dash-border flex items-center justify-center text-dash-text-subtle shadow-sm",
            inline || compact ? "w-10 h-10 mb-3" : "w-12 h-12 mb-4",
          ].join(" ")}
        >
          <Icon className={inline || compact ? "w-4 h-4" : "w-5 h-5"} strokeWidth={1.75} />
        </div>
      ) : null}
      <h4
        id={titleId}
        className="font-cabinet text-[17px] font-semibold text-dash-text tracking-tight"
      >
        {title}
      </h4>
      {description && (
        <p className="text-[13px] text-dash-text-muted mt-1.5 max-w-sm leading-relaxed">
          {description}
        </p>
      )}
      {(cta && onCta) || (secondaryCta && onSecondaryCta) ? (
        <div
          className={[
            "flex flex-col sm:flex-row items-center justify-center gap-2",
            cta && onCta ? "mt-5" : "mt-5",
          ].join(" ")}
        >
          {cta && onCta ? (
            <ActionButton
              variant={ctaVariant}
              onClick={onCta}
              data-testid={`${testId}-cta`}
            >
              {cta}
            </ActionButton>
          ) : null}
          {secondaryCta && onSecondaryCta ? (
            <ActionButton
              variant={secondaryCtaVariant}
              onClick={onSecondaryCta}
              data-testid={`${testId}-secondary-cta`}
            >
              {secondaryCta}
            </ActionButton>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
