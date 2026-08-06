import {
  LayoutDashboard,
  Users,
  UserPlus,
  ScrollText,
  FileStack,
  BarChart3,
  Settings,
} from "lucide-react";

/**
 * Primary dashboard nav. "Clients potentiels" sits next to Clients —
 * unknown contacts are the natural next step before Documents/Activity.
 */
export function getSidebarItems(t) {
  return [
    {
      to: "/dashboard",
      key: "dashboard",
      icon: LayoutDashboard,
      label: t("nav.dashboard"),
      end: true,
      badgeKey: "actionsPending",
    },
    { to: "/dashboard/clients", key: "clients", icon: Users, label: t("nav.clients") },
    {
      to: "/dashboard/prospects",
      key: "prospects",
      icon: UserPlus,
      label: t("nav.prospects"),
      badgeKey: "prospectsPending",
    },
    { to: "/dashboard/documents", key: "documents", icon: FileStack, label: t("nav.documents") },
    { to: "/dashboard/analytics", key: "analytics", icon: BarChart3, label: t("nav.analytics") },
    { to: "/dashboard/communications", key: "communications", icon: ScrollText, label: t("nav.communications") },
    { to: "/dashboard/settings", key: "settings", icon: Settings, label: t("nav.settings") },
  ];
}

/** Thumb-zone destinations for mobile bottom nav (excludes Plus / More). */
export function getMobilePrimaryNavItems(t) {
  return [
    {
      to: "/dashboard",
      key: "dashboard",
      icon: LayoutDashboard,
      label: t("nav.dashboard"),
      shortLabel: t("nav.dashboardShort"),
      end: true,
      badgeKey: "actionsPending",
    },
    {
      to: "/dashboard/clients",
      key: "clients",
      icon: Users,
      label: t("nav.clients"),
      shortLabel: t("nav.clients"),
    },
    {
      to: "/dashboard/prospects",
      key: "prospects",
      icon: UserPlus,
      label: t("nav.prospects"),
      shortLabel: t("nav.prospectsShort"),
      badgeKey: "prospectsPending",
    },
    {
      to: "/dashboard/documents",
      key: "documents",
      icon: FileStack,
      label: t("nav.documents"),
      shortLabel: t("nav.documents"),
    },
  ];
}

/** Secondary destinations opened from the hamburger “More” sheet on mobile. */
export function getMobileMoreNavItems(t) {
  return [
    { to: "/dashboard/communications", key: "communications", icon: ScrollText, label: t("nav.communications") },
    { to: "/dashboard/analytics", key: "analytics", icon: BarChart3, label: t("nav.analytics") },
    { to: "/dashboard/settings", key: "settings", icon: Settings, label: t("nav.settings") },
  ];
}
