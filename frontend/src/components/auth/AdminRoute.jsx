import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { Loader2, ShieldAlert } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

export const AdminRoute = ({ children }) => {
  const { user, isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <Loader2 className="w-6 h-6 animate-spin text-indigo-400" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (!user?.isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-200 px-6">
        <div className="max-w-md text-center space-y-3">
          <ShieldAlert className="w-10 h-10 mx-auto text-amber-400" />
          <h1 className="text-xl font-semibold">Accès refusé</h1>
          <p className="text-sm text-slate-400">Cet espace est réservé aux administrateurs MemoryHub.</p>
        </div>
      </div>
    );
  }

  return children;
};
