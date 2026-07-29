import { Navigate, useLocation } from "react-router-dom";

/**
 * Redirects legacy /dashboard/quotes and /dashboard/invoices routes
 * to the commercial documents hub while preserving useful query params.
 */
export default function LegacyCommercialDocumentsRedirect({ kind }) {
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  if (kind === "quote" || kind === "invoice") {
    params.set("kind", kind);
  }
  const search = params.toString();
  return <Navigate to={`/dashboard/documents${search ? `?${search}` : ""}`} replace />;
}
