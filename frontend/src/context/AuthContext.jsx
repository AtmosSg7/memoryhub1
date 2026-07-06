import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    try {
      const { res, data } = await apiFetch("/api/auth/me", {
        signal: AbortSignal.timeout(15000),
      });
      if (res.ok) {
        setUser(data);
        return data;
      }
    } catch {
      // Backend unreachable or session invalid — treat as logged out.
    }
    setUser(null);
    return null;
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        await refreshUser();
      } finally {
        if (active) setIsLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [refreshUser]);

  const login = useCallback(async (email, password) => {
    const { res, data } = await apiFetch("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const message = data?.detail?.message || data?.detail || "Login failed";
      throw new Error(typeof message === "string" ? message : "Login failed");
    }
    setUser(data.user);
    return data.user;
  }, []);

  const register = useCallback(async (payload) => {
    const { res, data } = await apiFetch("/api/auth/register", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const message = data?.detail?.message || data?.detail || "Registration failed";
      throw new Error(typeof message === "string" ? message : "Registration failed");
    }
    setUser(data.user);
    return data.user;
  }, []);

  const logout = useCallback(async () => {
    await apiFetch("/api/auth/logout", { method: "POST" });
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({
      user,
      isAuthenticated: !!user,
      isLoading,
      login,
      logout,
      register,
      refreshUser,
    }),
    [user, isLoading, login, logout, register, refreshUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};
