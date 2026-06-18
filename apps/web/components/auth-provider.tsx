"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

import { login as loginRequest, logout as logoutRequest, me as meRequest } from "@/lib/api";
import { readStoredAuth, type StoredAuth, writeStoredAuth } from "@/lib/auth";
import type { AuthUser } from "@/lib/types";

type AuthContextValue = {
  user: AuthUser | null;
  token: string;
  refreshToken: string;
  ready: boolean;
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  setAuth: (auth: StoredAuth | null) => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [auth, setAuthState] = useState<StoredAuth | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const stored = readStoredAuth();
    setAuthState(stored);
    setReady(true);
  }, []);

  const setAuth = (next: StoredAuth | null) => {
    setAuthState(next);
    writeStoredAuth(next);
  };

  const login = async (username: string, password: string) => {
    const response = await loginRequest(username, password);
    const next = {
      token: response.token || "",
      refreshToken: response.refreshToken || "",
      user: response.user,
    };
    setAuth(next);
  };

  const logout = async () => {
    try {
      await logoutRequest();
    } catch {
      // best effort only
    }
    setAuth(null);
  };

  useEffect(() => {
    if (!ready || !auth?.token) {
      return;
    }
    meRequest().then((response) => {
      setAuth({ ...auth, user: response.user });
    }).catch(() => {
      setAuth(null);
    });
  }, [ready]);

  const value = useMemo<AuthContextValue>(() => ({
    user: auth?.user || null,
    token: auth?.token || "",
    refreshToken: auth?.refreshToken || "",
    ready,
    isAuthenticated: !!auth?.token,
    login,
    logout,
    setAuth,
  }), [auth, ready]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
