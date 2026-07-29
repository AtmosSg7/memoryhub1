import React from "react";
import { Sentry } from "@/lib/sentry";
import { useLang } from "@/context/LanguageContext";

function ErrorFallback() {
  const { t } = useLang();
  return (
    <div className="flex min-h-screen items-center justify-center p-6 text-center">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">{t("errorBoundary.title")}</h1>
        <p className="mt-2 text-sm text-slate-600">{t("errorBoundary.desc")}</p>
      </div>
    </div>
  );
}

export function ErrorBoundary({ children }) {
  return (
    <Sentry.ErrorBoundary fallback={<ErrorFallback />} showDialog={false}>
      {children}
    </Sentry.ErrorBoundary>
  );
}
