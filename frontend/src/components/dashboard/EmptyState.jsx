import { Button } from "@/components/ui/button";

export default function EmptyState({
  icon: Icon,
  title,
  description,
  cta,
  onCta,
  testId,
  compact = false,
}) {
  return (
    <div
      data-testid={testId}
      className={[
        "flex flex-col items-center justify-center text-center border-2 border-dashed border-[#E5E7EB] rounded-xl bg-[#FAFAFA]",
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
      {cta && (
        <Button
          onClick={onCta}
          data-testid={`${testId}-cta`}
          variant="outline"
          className="mt-5 h-9 text-sm rounded-lg border-[#E5E7EB] bg-white text-[#111827] hover:bg-[#F3F4F6] shadow-sm"
        >
          {cta}
        </Button>
      )}
    </div>
  );
}
