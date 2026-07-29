import { Link } from "react-router-dom";
import { useLang } from "@/context/LanguageContext";
import { useAuth } from "@/context/AuthContext";
import { ActionButton } from "@/components/dashboard/ActionButton";

export default function NotFoundPage() {
  const { t } = useLang();
  const { isAuthenticated } = useAuth();
  const homePath = isAuthenticated ? "/dashboard" : "/";

  return (
    <div className="min-h-screen bg-[#F9FAFB] flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center space-y-4">
        <h1 className="font-cabinet text-2xl font-bold text-[#111827]">{t("notFound.title")}</h1>
        <p className="text-sm text-[#6B7280]">{t("notFound.desc")}</p>
        <Link to={homePath}>
          <ActionButton variant="primary">{t("notFound.back")}</ActionButton>
        </Link>
      </div>
    </div>
  );
}
