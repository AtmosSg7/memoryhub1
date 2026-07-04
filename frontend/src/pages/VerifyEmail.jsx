import React, { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { useLang } from "@/context/LanguageContext";
import { apiFetch } from "@/lib/api";
import { VERIFY_EMAIL } from "@/constants/testIds/auth";

const VerifyEmail = () => {
  const { t } = useLang();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const [status, setStatus] = useState(token ? "loading" : "missing");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!token) return;

    let active = true;
    (async () => {
      const { res, data } = await apiFetch("/api/auth/verify-email", {
        method: "POST",
        body: JSON.stringify({ token }),
      });
      if (!active) return;
      if (res.ok) {
        setStatus("success");
        setMessage(data?.message || t("auth.verifyEmail.success"));
      } else {
        setStatus("error");
        setMessage(data?.detail?.message || t("auth.verifyEmail.error"));
      }
    })();

    return () => {
      active = false;
    };
  }, [token, t]);

  if (status === "loading") {
    return (
      <AuthLayout title={t("auth.verifyEmail.title")} subtitle={t("auth.verifyEmail.loading")}>
        <div className="flex flex-col items-center py-6 text-[#52535E]" data-testid={VERIFY_EMAIL.loading}>
          <Loader2 className="w-8 h-8 animate-spin text-[#4F46E5]" />
        </div>
      </AuthLayout>
    );
  }

  if (status === "missing") {
    return (
      <AuthLayout title={t("auth.verifyEmail.title")} subtitle={t("auth.verifyEmail.missingToken")}>
        <div className="text-center py-4" data-testid={VERIFY_EMAIL.error}>
          <XCircle className="w-10 h-10 text-red-500 mx-auto" />
          <p className="mt-4 text-[15px] text-[#52535E]">{t("auth.verifyEmail.missingToken")}</p>
          <Link to="/login" className="inline-block mt-6 text-[14px] font-semibold text-[#4F46E5] hover:underline">
            {t("auth.verifyEmail.backToLogin")}
          </Link>
        </div>
      </AuthLayout>
    );
  }

  const isSuccess = status === "success";

  return (
    <AuthLayout
      title={isSuccess ? t("auth.verifyEmail.successTitle") : t("auth.verifyEmail.errorTitle")}
      subtitle={message}
    >
      <div className="text-center py-4" data-testid={isSuccess ? VERIFY_EMAIL.success : VERIFY_EMAIL.error}>
        {isSuccess ? (
          <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
        ) : (
          <XCircle className="w-10 h-10 text-red-500 mx-auto" />
        )}
        <Link to="/login" className="inline-block mt-6 text-[14px] font-semibold text-[#4F46E5] hover:underline">
          {t("auth.verifyEmail.backToLogin")}
        </Link>
      </div>
    </AuthLayout>
  );
};

export default VerifyEmail;
