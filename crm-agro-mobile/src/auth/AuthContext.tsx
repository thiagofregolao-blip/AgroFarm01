import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { api, attachAuthInterceptors } from "@api/client";

type User = { id: string; username: string; role: string } | null;

type AuthCtx = {
  user: User;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  ensure: () => Promise<void>;
};

const Ctx = createContext<AuthCtx>(null as any);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    attachAuthInterceptors(() => setUser(null));
    ensure();
  }, []);

  async function ensure() {
    try {
      setLoading(true);
      const { data } = await api.get("/api/user");
      setUser(data || null);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }

  async function login(username: string, password: string) {
    await api.post("/api/login", { username, password });
    await ensure();
  }

  async function logout() {
    try {
      await api.post("/api/logout");
    } catch {}
    setUser(null);
  }

  const value = useMemo(() => ({ user, loading, login, logout, ensure }), [user, loading]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  return useContext(Ctx);
}
