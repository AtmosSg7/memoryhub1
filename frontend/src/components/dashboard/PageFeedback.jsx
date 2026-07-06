import { Loader2 } from "lucide-react";

export function PageLoader({ label, testId = "page-loading" }) {
  return (
    <div
      className="flex items-center justify-center py-16 text-[#6B7280]"
      data-testid={testId}
    >
      <Loader2 className="w-5 h-5 animate-spin mr-2" />
      {label}
    </div>
  );
}

export function PageError({ message, testId = "page-error" }) {
  return (
    <div
      className="rounded-xl border border-[#FECACA] bg-[#FEF2F2] p-5 text-sm text-[#991B1B]"
      data-testid={testId}
    >
      {message}
    </div>
  );
}
