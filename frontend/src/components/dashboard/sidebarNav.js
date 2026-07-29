import {
  LayoutDashboard,
  Users,
  ScrollText,
  FileStack,
  BarChart3,
  Settings,
} from "lucide-react";

export function getSidebarItems(t) {
  return [
    { to: "/dashboard", key: "dashboard", icon: LayoutDashboard, label: t("nav.dashboard"), end: true },
    { to: "/dashboard/clients", key: "clients", icon: Users, label: t("nav.clients") },
    { to: "/dashboard/documents", key: "documents", icon: FileStack, label: t("nav.documents") },
    { to: "/dashboard/analytics", key: "analytics", icon: BarChart3, label: t("nav.analytics") },
    { to: "/dashboard/communications", key: "communications", icon: ScrollText, label: t("nav.communications") },
    { to: "/dashboard/settings", key: "settings", icon: Settings, label: t("nav.settings") },
  ];
}
