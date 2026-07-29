import React, { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { CheckCircle2, Loader2 } from "lucide-react";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { useLang } from "@/context/LanguageContext";
import { apiFetch } from "@/lib/api";
import { translateAuthError, extractAuthApiMessage } from "@/utils/authErrors";
import { RESET_PASSWORD } from "@/constants/testIds/auth";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";

const ResetPassword = () => {
  const { t } = useLang();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const [done, setDone] = useState(false);
  const [serverError, setServerError] = useState("");
  const [loading, setLoading] = useState(false);

  const schema = z
    .object({
      password: z.string().min(8, t("auth.errors.passwordMin")),
      confirmPassword: z.string().min(1, t("auth.errors.confirmPasswordRequired")),
    })
    .refine((data) => data.password === data.confirmPassword, {
      message: t("auth.errors.passwordMismatch"),
      path: ["confirmPassword"],
    });

  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: { password: "", confirmPassword: "" },
  });

  const onSubmit = async (values) => {
    if (!token) return;
    setServerError("");
    setLoading(true);
    try {
      const { res, data } = await apiFetch("/api/auth/reset-password", {
        method: "POST",
        body: JSON.stringify({ token, password: values.password }),
      });
      if (!res.ok) {
        setServerError(
          translateAuthError(extractAuthApiMessage(data, t("auth.errors.generic")), t, "auth.errors.generic")
        );
        return;
      }
      setDone(true);
    } catch {
      setServerError(t("auth.errors.generic"));
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <AuthLayout title={t("auth.resetPassword.title")} subtitle={t("auth.resetPassword.missingToken")}>
        <p className="text-center text-[15px] text-[#52535E]" data-testid={RESET_PASSWORD.error}>
          {t("auth.resetPassword.missingToken")}
        </p>
        <p className="mt-6 text-center">
          <Link to="/forgot-password" className="text-[14px] font-semibold text-[#4F46E5] hover:underline">
            {t("auth.resetPassword.requestNewLink")}
          </Link>
        </p>
      </AuthLayout>
    );
  }

  if (done) {
    return (
      <AuthLayout title={t("auth.resetPassword.successTitle")} subtitle={t("auth.resetPassword.successSubtitle")}>
        <div className="text-center py-2" data-testid={RESET_PASSWORD.success}>
          <div className="w-14 h-14 rounded-2xl bg-emerald-50 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-8 h-8 text-emerald-500" />
          </div>
          <p className="mt-5 text-[15px] text-[#52535E] leading-[1.6]">{t("auth.resetPassword.successBody")}</p>
          <Link to="/login" className="inline-block mt-6 text-[14px] font-semibold text-[#4F46E5] hover:underline">
            {t("auth.resetPassword.backToLogin")}
          </Link>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title={t("auth.resetPassword.title")} subtitle={t("auth.resetPassword.subtitle")}>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-[#0A0A0B]">{t("auth.fields.newPassword")}</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    type="password"
                    autoComplete="new-password"
                    data-testid={RESET_PASSWORD.passwordInput}
                    className="h-11 rounded-xl border-[#E7E9EE] focus-visible:ring-[#4F46E5]/15"
                  />
                </FormControl>
                <FormMessage className="text-[13px]" />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="confirmPassword"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-[#0A0A0B]">{t("auth.fields.confirmPassword")}</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    type="password"
                    autoComplete="new-password"
                    data-testid={RESET_PASSWORD.confirmPasswordInput}
                    className="h-11 rounded-xl border-[#E7E9EE] focus-visible:ring-[#4F46E5]/15"
                  />
                </FormControl>
                <FormMessage className="text-[13px]" />
              </FormItem>
            )}
          />
          {serverError && (
            <p className="text-[13px] text-red-500" role="alert" data-testid={RESET_PASSWORD.error}>
              {serverError}
            </p>
          )}
          <button
            type="submit"
            disabled={loading}
            data-testid={RESET_PASSWORD.submitButton}
            className="btn-primary w-full justify-center mt-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {t("auth.resetPassword.loading")}
              </>
            ) : (
              t("auth.resetPassword.submit")
            )}
          </button>
        </form>
      </Form>
      <p className="mt-6 text-center text-[14px] text-[#52535E]">
        <Link to="/login" className="font-semibold text-[#4F46E5] hover:underline">
          {t("auth.resetPassword.backToLogin")}
        </Link>
      </p>
    </AuthLayout>
  );
};

export default ResetPassword;
