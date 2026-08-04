import { memo } from "react";
import { Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

/**
 * Discrete info icon + tooltip for artisan-friendly KPI definitions.
 */
function KpiInfoHint({ label, text, testId }) {
  if (!text) return null;
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className="inline-flex items-center justify-center rounded-md p-0.5 text-dash-text-subtle hover:text-dash-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dash-primary/30"
            aria-label={label || text}
            data-testid={testId}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          >
            <Info className="w-3.5 h-3.5" aria-hidden />
          </button>
        </TooltipTrigger>
        <TooltipContent
          side="top"
          className="max-w-[240px] text-xs leading-snug px-3 py-2"
        >
          {text}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export default memo(KpiInfoHint);
