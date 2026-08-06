import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { isShowcaseApiActive } from "@/lib/api";
import "./showcaseExploreLock.css";

/** Routes the interactive demo may open (consultation only). */
export const SHOWCASE_ALLOWED_PATH =
  /^\/dashboard\/?$|^\/dashboard\/(?:clients(?:\/[^/]+)?|documents|analytics|communications|timeline|search)\/?$/;

const CLOSE_LABELS = new Set(["fermer", "close", "annuler", "cancel"]);

const LOCKED_CONTROL_SELECTOR = [
  '[data-testid*="favorite"]',
  '[data-testid*="delete"]',
  '[data-testid*="edit"]',
  '[data-testid*="create"]',
  '[data-testid*="import"]',
  '[data-testid*="add-"]',
  '[data-testid$="-add"]',
  '[data-testid$="-primary"]',
  '[data-testid*="row-more"]',
  '[data-testid*="more-actions"]',
  '[data-testid*="more-menu"]',
  '[data-testid*="associate"]',
  '[data-testid*="-send"]',
  '[data-testid*="payment"]',
  '[data-testid*="follow-up"]',
  '[data-testid*="followUp"]',
  '[data-testid*="mark-"]',
  '[data-testid*="relance"]',
  '[data-testid="client-add-menu"]',
  '[data-testid="client-create-note"]',
  '[data-testid="client-import-document"]',
  '[data-testid="client-detail-edit"]',
  '[data-testid="client-detail-delete"]',
  '[data-testid="commercial-documents-header-actions"]',
  '[data-testid="commercial-detail-edit"]',
  '[data-testid="sidebar-upgrade-cta"]',
  '[data-testid="dashboard-quick-actions"]',
  '[data-testid="action-center"] button',
  '[data-testid="topbar-notifications-btn"]',
  '[data-testid="topbar-profile-btn"]',
  '[data-testid="profile-menu-account"]',
  '[data-testid="profile-menu-billing"]',
  '[data-testid="profile-menu-feedback"]',
  '[data-testid="sidebar-nav-settings"]',
  '[data-testid="mobile-nav-settings"]',
  '[data-testid="quote-accepted-banner"] button',
  '[data-testid="unlinked-emails-inbox"] button',
].join(",");

const EXPLORATION_TARGET_SELECTOR = [
  '[data-testid="sidebar-nav-dashboard"]',
  '[data-testid="sidebar-nav-clients"]',
  '[data-testid="sidebar-nav-documents"]',
  '[data-testid="sidebar-nav-analytics"]',
  '[data-testid="sidebar-nav-communications"]',
  '[data-testid="mobile-nav-analytics"]',
  '[data-testid="mobile-nav-communications"]',
  '[data-testid="mobile-nav-settings"]',
  '[data-testid="mobile-bottom-nav"]',
  '[data-testid="mobile-bottom-dashboard"]',
  '[data-testid="mobile-bottom-clients"]',
  '[data-testid="mobile-bottom-prospects"]',
  '[data-testid="mobile-bottom-documents"]',
  '[data-testid="mobile-bottom-plus"]',
  '[data-testid="mobile-plus-sheet"]',
  '[data-testid="mobile-plus-sheet"] *',
  '[data-testid="topbar-mobile-menu"]',
  '[data-testid="mobile-nav-sheet"]',
  '[data-testid="topbar-theme-toggle"]',
  '[data-testid="topbar-lang-toggle"]',
  '[data-testid="topbar-lang-fr"]',
  '[data-testid="topbar-lang-en"]',
  '[data-testid="topbar-search-input"]',
  '[data-testid="search-dropdown"]',
  '[data-testid="search-dropdown"] *',
  '[data-testid^="search-"]',
  '[data-testid^="dashboard-period-"]',
  '[data-testid="dashboard-analytics-all-link"]',
  '[data-testid="top-clients-view-all"]',
  '[data-testid^="top-client-"]',
  '[data-testid="activity-feed-view-all"]',
  '[data-testid^="activity-feed-item-"]',
  '[data-testid="clients-search-input"]',
  '[data-testid="clients-sort"]',
  '[data-testid="clients-filter"]',
  '[data-testid^="clients-filter-"]',
  '[data-testid^="client-card-"]',
  '[data-testid="client-section-nav"]',
  '[data-testid="client-section-nav"] *',
  '[data-testid="client-detail-back"]',
  '[data-testid="client-detail-prev"]',
  '[data-testid="client-detail-next"]',
  '[data-testid^="client-nav-"]',
  '[data-testid^="client-timeline-item-"]',
  '[data-testid="commercial-documents-kind-filter"]',
  '[data-testid^="commercial-documents-filter-"]',
  '[data-testid="commercial-documents-client-filter"]',
  '[data-testid="commercial-documents-client-filter"] *',
  '[data-testid="commercial-documents-period"]',
  '[data-testid="commercial-documents-period"] *',
  '[data-testid="commercial-documents-from"]',
  '[data-testid="commercial-documents-to"]',
  '[data-testid="commercial-documents-quote-status"]',
  '[data-testid="commercial-documents-quote-status"] *',
  '[data-testid="commercial-documents-invoice-status"]',
  '[data-testid="commercial-documents-invoice-status"] *',
  '[data-testid^="quote-row-"]',
  '[data-testid^="invoice-row-"]',
  '[data-testid^="row-primary-view-"]',
  '[data-testid^="analytics-period-"]',
  '[data-testid="analytics-custom-range"]',
  '[data-testid="analytics-custom-range"] *',
  '[data-testid^="analytics-sort-"]',
  '[data-testid^="analytics-kpi-"]',
  '[data-testid="communication-link-scopes"]',
  '[data-testid="communication-link-scopes"] *',
  '[data-testid^="communication-scope-"]',
  '[data-testid="communication-filters"]',
  '[data-testid^="communication-filter-"]',
  '[data-testid="communications-client-filter"]',
  '[data-testid="communications-client-filter"] *',
  '[data-testid^="communication-timeline"]',
  'a[href="/dashboard"]',
  'a[href="/dashboard/"]',
  'a[href="/dashboard/clients"]',
  'a[href^="/dashboard/clients/"]',
  'a[href="/dashboard/documents"]',
  'a[href^="/dashboard/documents"]',
  'a[href="/dashboard/analytics"]',
  'a[href^="/dashboard/analytics"]',
  'a[href="/dashboard/communications"]',
  'a[href^="/dashboard/communications"]',
  'a[href="/dashboard/timeline"]',
  'a[href^="/dashboard/search"]',
].join(",");

function normalizedLabel(el) {
  return (el?.textContent || "").replace(/\s+/g, " ").trim().toLowerCase();
}

function isDismissChrome(target) {
  if (!(target instanceof Element)) return false;
  if (target.closest("[data-radix-dialog-close]")) return true;
  if (target.closest("[data-radix-sheet-close]")) return true;
  if (target.closest('[role="dialog"] button.absolute.right-4.top-4')) return true;

  if (
    target.matches("[data-state]") &&
    target.classList.contains("fixed") &&
    target.classList.contains("inset-0") &&
    !target.closest('[role="dialog"]')
  ) {
    return true;
  }

  return false;
}

function isShowcasePortaledUi(target) {
  if (!(target instanceof Element) || !isShowcaseApiActive()) return false;
  return Boolean(
    target.closest('[role="dialog"]') ||
      target.closest("[data-radix-popper-content-wrapper]") ||
      target.closest("[data-radix-select-content]") ||
      target.closest('[role="listbox"]') ||
      target.closest('[role="menu"]') ||
      target.closest("[data-radix-menu-content]") ||
      target.closest("[data-radix-dropdown-menu-content]") ||
      (target.matches("[data-state]") &&
        target.classList.contains("fixed") &&
        target.classList.contains("inset-0"))
  );
}

function isFilterSelectPortal(target) {
  if (!(target instanceof Element)) return false;
  return Boolean(target.closest("[data-radix-select-content]") || target.closest('[role="listbox"]'));
}

/**
 * Dialogs are read-only: only dismiss / close labels may activate.
 * @returns {boolean|null} null when target is not inside a dialog
 */
function dialogInteractionAllowed(target) {
  if (!(target instanceof Element)) return null;
  const dialog = target.closest('[role="dialog"]');
  if (!dialog) return null;

  if (isDismissChrome(target)) return true;

  const interactive = target.closest(
    'button, a, [role="menuitem"], [role="option"], input, select, textarea, [role="switch"]'
  );
  if (!interactive) return true; // reading / scrolling

  if (interactive.closest('[role="menu"], [role="menuitem"]')) return false;

  if (
    interactive.matches("button, [role='button']") &&
    (CLOSE_LABELS.has(normalizedLabel(interactive)) ||
      interactive.closest('[data-testid="commercial-detail-close"]'))
  ) {
    return true;
  }

  return false;
}

/**
 * True when the click target is part of the guided exploration surface.
 */
export function isShowcaseExplorationTarget(target) {
  if (!(target instanceof Element)) return false;

  if (isDismissChrome(target)) return true;

  // Action menus never explore — open or select is write/destructive.
  if (target.closest('[role="menu"], [role="menuitem"], [data-radix-dropdown-menu-content]')) {
    return false;
  }

  if (target.closest(LOCKED_CONTROL_SELECTOR)) {
    return false;
  }

  const dialogAllowed = dialogInteractionAllowed(target);
  if (dialogAllowed != null) return dialogAllowed;

  if (isFilterSelectPortal(target)) return true;

  return Boolean(target.closest(EXPLORATION_TARGET_SELECTOR));
}

function ShowcaseRouteGuard({ children }) {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (!SHOWCASE_ALLOWED_PATH.test(location.pathname)) {
      navigate("/dashboard", { replace: true });
    }
  }, [location.pathname, navigate]);

  return children;
}

/**
 * Locks the real dashboard to read-only exploration inside the homepage demo.
 * Deny-by-default: only whitelisted consultation targets may receive activation.
 */
export function ShowcaseExploreLock({ children }) {
  const rootRef = useRef(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;

    const isActivatable = (target) => {
      if (!(target instanceof Element)) return false;
      return Boolean(
        target.closest(
          'button, a, input, select, textarea, summary, label, [role="button"], [role="menuitem"], [role="option"], [role="switch"], [role="tab"], [role="checkbox"], tr[data-testid^="quote-row-"], tr[data-testid^="invoice-row-"], [data-testid^="client-card-"], [data-testid^="top-client-"], [data-testid^="activity-feed-item-"], [data-testid^="row-primary-view-"]'
        )
      );
    };

    const block = (event) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      const inRoot = root.contains(target);
      const inPortal = isShowcasePortaledUi(target);
      if (!inRoot && !inPortal) return;
      if (isShowcaseExplorationTarget(target)) return;

      // Keep scroll / text selection on static surfaces; only stop activatable controls.
      if (event.type !== "submit" && !isActivatable(target)) return;

      event.preventDefault();
      event.stopPropagation();
      if (typeof event.stopImmediatePropagation === "function") {
        event.stopImmediatePropagation();
      }
    };

    const onKeyDown = (event) => {
      if (event.key === "Enter" || event.key === " ") block(event);
    };

    // pointerdown/mousedown: Radix menus open before click.
    const types = ["pointerdown", "mousedown", "click", "auxclick", "dblclick", "submit"];
    types.forEach((type) => document.addEventListener(type, block, true));
    document.addEventListener("keydown", onKeyDown, true);

    return () => {
      types.forEach((type) => document.removeEventListener(type, block, true));
      document.removeEventListener("keydown", onKeyDown, true);
    };
  }, []);

  return (
    <div
      ref={rootRef}
      className="showcase-explore-lock h-full min-h-0 overflow-hidden"
      data-testid="showcase-explore-lock"
    >
      <ShowcaseRouteGuard>{children}</ShowcaseRouteGuard>
    </div>
  );
}
