import React, { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { useLang } from "@/context/LanguageContext";
import { useAuth } from "@/context/AuthContext";
import { LOGIN } from "@/constants/testIds/auth";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";

const Login = () => {
  const { t } = useLang();
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [serverError, setServerError] = useState("");
  const [loading, setLoading] = useState(false);

  const schema = z.object({
    email: z.string().email(t("auth.errors.invalidEmail")),
    password: z.string().min(1, t("auth.errors.passwordRequired")),
  });

  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = async (values) => {
    setServerError("");
    setLoading(true);
    try {
      await login(values.email, values.password);
      const redirectTo = location.state?.from || "/dashboard";
      navigate(redirectTo, { replace: true });
    } catch (err) {
      setServerError(err.message || t("auth.errors.loginFailed"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout title={t("auth.login.title")} subtitle={t("auth.login.subtitle")}>
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
                    data-testid={LOGIN.emailInput}
                    className="h-11 rounded-xl border-[#E7E9EE] focus-visible:ring-[#4F46E5]/15"
                  />
                </FormControl>
                <FormMessage className="text-[13px]" />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <div className="flex items-center justify-between">
                  <FormLabel className="text-[#0A0A0B]">{t("auth.fields.password")}</FormLabel>
                  <Link
                    to="/forgot-password"
                    data-testid={LOGIN.forgotPasswordLink}
                    className="text-[12px] font-medium text-[#4F46E5] hover:underline"
                  >
                    {t("auth.login.forgotPassword")}
                  </Link>
                </div>
                <FormControl>
                  <Input
                    {...field}
                    type="password"
                    autoComplete="current-password"
                    data-testid={LOGIN.passwordInput}
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
          <button
            type="submit"
            disabled={loading}
            data-testid={LOGIN.submitButton}
            className="btn-primary w-full justify-center mt-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {t("auth.login.loading")}
              </>
            ) : (
              t("auth.login.submit")
            )}
          </button>
        </form>
      </Form>
      <p className="mt-6 text-center text-[14px] text-[#52535E]">
        {t("auth.login.noAccount")}{" "}
        <Link
          to="/register"
          data-testid={LOGIN.registerLink}
          className="font-semibold text-[#4F46E5] hover:underline"
        >
          {t("auth.login.createAccount")}
        </Link>
      </p>
    </AuthLayout>
  );
};

export default Login;
