import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export const actionButtonVariants = {
  primary:
    "h-10 px-4 rounded-lg bg-[#0A2540] hover:bg-[#173A5E] text-white shadow-sm border-transparent font-medium",
  secondary:
    "h-10 px-4 rounded-lg border-[#E5E7EB] bg-white text-[#111827] hover:bg-[#F3F4F6] font-medium shadow-none",
  quick:
    "h-8 px-3 text-xs font-semibold rounded-lg border border-[#E5E7EB] bg-white text-[#111827] hover:bg-[#F3F4F6] shadow-none",
  success:
    "h-8 px-3 text-xs font-semibold rounded-lg border border-[#A7F3D0] bg-[#ECFDF5] text-[#065F46] hover:bg-[#D1FAE5] shadow-none",
  accent:
    "h-8 px-3 text-xs font-semibold rounded-lg border border-[#BFDBFE] bg-white text-[#0A2540] hover:bg-[#EFF6FF] shadow-none",
  ghostIcon:
    "h-8 w-8 p-0 rounded-lg text-[#6B7280] hover:text-[#111827] hover:bg-[#F3F4F6] border-transparent shadow-none",
  dangerIcon:
    "h-8 w-8 p-0 rounded-lg text-[#991B1B] hover:text-[#991B1B] hover:bg-[#FEF2F2] border-transparent shadow-none",
  dangerText:
    "h-8 px-3 text-xs font-semibold rounded-lg border border-[#FECACA] bg-white text-[#991B1B] hover:bg-[#FEF2F2] shadow-none",
};

export function ActionButton({ variant = "secondary", className, ...props }) {
  return (
    <Button
      type="button"
      variant="outline"
      className={cn(actionButtonVariants[variant], className)}
      {...props}
    />
  );
}
