import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { apiFetch } from "@/lib/api";
import { setSentryUser } from "@/lib/sentry";
import { extractAuthApiMessage } from "@/utils/authErrors";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const authEpochRef = useRef(0);

  const bumpAuthEpoch = useCallback(() => {
    authEpochRef.current += 1;
    return authEpochRef.current;
  }, []);

  const refreshUser = useCallback(async () => {
    const epochAtStart = authEpochRef.current;
    try {
      const { res, data } = await apiFetch("/api/auth/me", {
        timeoutMs: 15_000,
        bypassShowcase: true,
      });
      if (epochAtStart !== authEpochRef.current) {
        return null;
      }
      if (res.ok) {
        setUser(data);
        return data;
      }
    } catch {
      if (epochAtStart !== authEpochRef.current) {
        return null;
      }
      // Backend unreachable or session invalid — treat as logged out.
    }
    if (epochAtStart !== authEpochRef.current) {
      return null;
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

  useEffect(() => {
    setSentryUser(user);
  }, [user]);

  const login = useCallback(async (email, password, abuse = {}) => {
    bumpAuthEpoch();
    const { res, data } = await apiFetch("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({
        email,
        password,
        website: abuse.website ?? "",
        formStartedAt: abuse.formStartedAt,
      }),
      timeoutMs: 15_000,
      bypassShowcase: true,
    });
    if (!res.ok) {
      const message = extractAuthApiMessage(data, "Invalid email or password.");
      throw new Error(message);
    }
    setUser(data.user);
    return data.user;
  }, [bumpAuthEpoch]);

  const register = useCallback(async (payload) => {
    bumpAuthEpoch();
    const { res, data } = await apiFetch("/api/auth/register", {
      method: "POST",
      body: JSON.stringify(payload),
      timeoutMs: 15_000,
      bypassShowcase: true,
    });
    if (!res.ok) {
      const message = extractAuthApiMessage(data, "Unable to create account.");
      throw new Error(message);
    }
    setUser(data.user);
    return data.user;
  }, [bumpAuthEpoch]);

  const logout = useCallback(async () => {
    bumpAuthEpoch();
    await apiFetch("/api/auth/logout", {
      method: "POST",
      timeoutMs: 15_000,
      bypassShowcase: true,
    });
    setUser(null);
  }, [bumpAuthEpoch]);

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

/** Fixed session for the homepage product demo (no /api/auth calls). */
export function ShowcaseAuthProvider({ user, children }) {
  const value = useMemo(
    () => ({
      user,
      isAuthenticated: !!user,
      isLoading: false,
      login: async () => user,
      logout: async () => {},
      register: async () => user,
      refreshUser: async () => user,
    }),
    [user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
