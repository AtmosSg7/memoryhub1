import * as React from "react"

import { cn } from "@/lib/utils"

const Textarea = React.forwardRef(({ className, ...props }, ref) => {
  return (
    <textarea
      className={cn(
        "flex min-h-[88px] w-full rounded-xl border border-input bg-[var(--dash-input-bg,hsl(var(--background)))] px-3 py-2 text-sm text-foreground shadow-none placeholder:text-muted-foreground hover:bg-[var(--dash-input-bg-hover,hsl(var(--muted)))] focus-visible:outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      ref={ref}
      {...props} />
  );
})
Textarea.displayName = "Textarea"

export { Textarea }
