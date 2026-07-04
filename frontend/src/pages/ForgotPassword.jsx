import React, { useState } from "react";
import { Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { CheckCircle2, Loader2 } from "lucide-react";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { useLang } from "@/context/LanguageContext";
import { apiFetch } from "@/lib/api";
import { FORGOT_PASSWORD } from "@/constants/testIds/auth";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";

const ForgotPassword = () => {
  const { t } = useLang();
  const [sent, setSent] = useState(false);
  const [serverError, setServerError] = useState("");
  const [loading, setLoading] = useState(false);

  const schema = z.object({
    email: z.string().email(t("auth.errors.invalidEmail")),
  });

  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: { email: "" },
  });

  const onSubmit = async (values) => {
    setServerError("");
    setLoading(true);
    try {
      const { res, data } = await apiFetch("/api/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify({ email: values.email.trim() }),
      });
      if (!res.ok) {
        setServerError(data?.detail?.message || t("auth.errors.generic"));
        return;
      }
      setSent(true);
    } catch {
      setServerError(t("auth.errors.generic"));
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <AuthLayout title={t("auth.forgotPassword.successTitle")} subtitle={t("auth.forgotPassword.successSubtitle")}>
        <div className="text-center py-2" data-testid={FORGOT_PASSWORD.successMessage}>
          <div className="w-14 h-14 rounded-2xl bg-emerald-50 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-8 h-8 text-emerald-500" />
          </div>
          <p className="mt-5 text-[15px] text-[#52535E] leading-[1.6]">{t("auth.forgotPassword.successBody")}</p>
          <Link to="/login" className="inline-block mt-6 text-[14px] font-semibold text-[#4F46E5] hover:underline">
            {t("auth.forgotPassword.backToLogin")}
          </Link>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title={t("auth.forgotPassword.title")} subtitle={t("auth.forgotPassword.subtitle")}>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-[#0A0A0B]">{t("auth.fields.email")}</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    type="email"
                    autoComplete="email"
                    data-testid={FORGOT_PASSWORD.emailInput}
                    className="h-11 rounded-xl border-[#E7E9EE] focus-visible:ring-[#4F46E5]/15"
                  />
                </FormControl>
                <FormMessage className="text-[13px]" />
              </FormItem>
            )}
          />
          {serverError && (
            <p className="text-[13px] text-red-500" role="alert">
              {serverError}
            </p>
          )}
          <button type="submit" disabled={loading} data-testid={FORGOT_PASSWORD.submitButton} className="btn-primary w-full justify-center mt-2">
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {t("auth.forgotPassword.loading")}
              </>
            ) : (
              t("auth.forgotPassword.submit")
            )}
          </button>
        </form>
      </Form>
      <p className="mt-6 text-center text-[14px] text-[#52535E]">
        <Link to="/login" className="font-semibold text-[#4F46E5] hover:underline">
          {t("auth.forgotPassword.backToLogin")}
        </Link>
      </p>
    </AuthLayout>
  );
};

export default ForgotPassword;
