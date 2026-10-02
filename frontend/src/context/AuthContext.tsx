import { createContext, useContext, useState, ReactNode } from 'react';
import { AuthApi } from '../api/client';

export type AppRole = 'SUPERADMIN' | 'ADMIN' | 'RAHBAR' | 'TEACHER';

export interface CurrentUser {
  id: string;
  name: string;
  phone: string;
  role: AppRole;
  teacherId?: string;
  avatarUrl?: string;
}

interface AuthContextValue {
  user: CurrentUser | null;
  login: (phone: string, password: string) => Promise<void>;
  logout: () => void;
  updateUser: (patch: Partial<CurrentUser>) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(() => {
    const raw = localStorage.getItem('user');
    return raw ? JSON.parse(raw) : null;
  });

  async function login(phone: string, password: string) {
    const res = await AuthApi.login(phone, password);
    localStorage.setItem('token', res.data.accessToken);
    localStorage.setItem('user', JSON.stringify(res.data.user));
    setUser(res.data.user);
  }

  function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  }

  function updateUser(patch: Partial<CurrentUser>) {
    setUser((prev) => {
      if (!prev) return prev;
      const next = { ...prev, ...patch };
      localStorage.setItem('user', JSON.stringify(next));
      return next;
    });
  }

  return <AuthContext.Provider value={{ user, login, logout, updateUser }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth AuthProvider ichida ishlatilishi kerak');
  return ctx;
}
