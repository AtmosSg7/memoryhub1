import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { useLang } from "@/context/LanguageContext";
import { useAuth } from "@/context/AuthContext";
import { REGISTER } from "@/constants/testIds/auth";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";

const Register = () => {
  const { t } = useLang();
  const { register: registerUser } = useAuth();
  const navigate = useNavigate();
  const [serverError, setServerError] = useState("");
  const [loading, setLoading] = useState(false);

  const schema = z
    .object({
      firstName: z.string().min(1, t("auth.errors.firstNameRequired")),
      lastName: z.string().min(1, t("auth.errors.lastNameRequired")),
      companyName: z.string().min(1, t("auth.errors.companyRequired")),
      email: z.string().email(t("auth.errors.invalidEmail")),
      password: z.string().min(8, t("auth.errors.passwordMin")),
      confirmPassword: z.string().min(1, t("auth.errors.confirmPasswordRequired")),
    })
    .refine((data) => data.password === data.confirmPassword, {
      message: t("auth.errors.passwordMismatch"),
      path: ["confirmPassword"],
    });

  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      firstName: "",
      lastName: "",
      companyName: "",
      email: "",
      password: "",
      confirmPassword: "",
    },
  });

  const onSubmit = async (values) => {
    setServerError("");
    setLoading(true);
    try {
      await registerUser({
        firstName: values.firstName.trim(),
        lastName: values.lastName.trim(),
        companyName: values.companyName.trim(),
        email: values.email.trim(),
        password: values.password,
      });
      navigate("/dashboard", { replace: true });
    } catch (err) {
      setServerError(err.message || t("auth.errors.registerFailed"));
    } finally {
      setLoading(false);
    }
  };

  const inputClass = "h-11 rounded-xl border-[#E7E9EE] focus-visible:ring-[#4F46E5]/15";

  return (
    <AuthLayout title={t("auth.register.title")} subtitle={t("auth.register.subtitle")}>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="firstName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[#0A0A0B]">{t("auth.fields.firstName")}</FormLabel>
                  <FormControl>
                    <Input {...field} autoComplete="given-name" data-testid={REGISTER.nameInput} className={inputClass} />
                  </FormControl>
                  <FormMessage className="text-[13px]" />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="lastName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[#0A0A0B]">{t("auth.fields.lastName")}</FormLabel>
                  <FormControl>
                    <Input {...field} autoComplete="family-name" className={inputClass} />
                  </FormControl>
                  <FormMessage className="text-[13px]" />
                </FormItem>
              )}
            />
          </div>
          <FormField
            control={form.control}
            name="companyName"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-[#0A0A0B]">{t("auth.fields.companyName")}</FormLabel>
                <FormControl>
                  <Input {...field} autoComplete="organization" className={inputClass} />
                </FormControl>
                <FormMessage className="text-[13px]" />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-[#0A0A0B]">{t("auth.fields.email")}</FormLabel>
                <FormControl>
                  <Input {...field} type="email" autoComplete="email" data-testid={REGISTER.emailInput} className={inputClass} />
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
                <FormLabel className="text-[#0A0A0B]">{t("auth.fields.password")}</FormLabel>
                <FormControl>
                  <Input {...field} type="password" autoComplete="new-password" data-testid={REGISTER.passwordInput} className={inputClass} />
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
                  <Input {...field} type="password" autoComplete="new-password" data-testid={REGISTER.passwordConfirmInput} className={inputClass} />
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
          <button type="submit" disabled={loading} data-testid={REGISTER.submitButton} className="btn-primary w-full justify-center mt-2">
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {t("auth.register.loading")}
              </>
            ) : (
              t("auth.register.submit")
            )}
          </button>
        </form>
      </Form>
      <p className="mt-6 text-center text-[14px] text-[#52535E]">
        {t("auth.register.hasAccount")}{" "}
        <Link to="/login" data-testid={REGISTER.loginLink} className="font-semibold text-[#4F46E5] hover:underline">
          {t("auth.register.signIn")}
        </Link>
      </p>
    </AuthLayout>
  );
};

export default Register;
