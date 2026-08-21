'use client';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { authApi, onUnauthorized } from './api';
import type { Session } from './types';

const KEY = 'davi_session';
export function dashboardPathFor(session: Session | null) { return session?.user.school?.slug ? `/school/${session.user.school.slug}/dashboard` : '/dashboard'; }
interface AuthValue { session: Session | null; loading: boolean; login: (identifier: string, password: string) => Promise<boolean>; refresh: () => Promise<void>; logout: () => void; can: (code: string) => boolean }
const AuthContext = createContext<AuthValue | null>(null);
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null); const [loading, setLoading] = useState(true); const router = useRouter(); const path = usePathname();
  const logout = useCallback(() => { localStorage.removeItem(KEY); setSession(null); router.replace('/login'); }, [router]);
  const refresh = useCallback(async () => { const raw = localStorage.getItem(KEY); if (!raw) { setLoading(false); return; } try { const stored = JSON.parse(raw) as Session; const me = await authApi.me(stored.token); const next = { ...stored, ...me, user: { ...stored.user, ...me.user } }; localStorage.setItem(KEY, JSON.stringify(next)); setSession(next); } catch { localStorage.removeItem(KEY); setSession(null); } finally { setLoading(false); } }, []);
  useEffect(() => { void refresh(); }, [refresh]); useEffect(() => onUnauthorized(logout), [logout]);
  useEffect(() => { const isLoginPath = path === '/login' || /^\/school\/[^/]+\/login$/.test(path); if (loading) return; if (!session && !isLoginPath) router.replace('/login'); else if (session?.user.mustChangePassword && path !== '/change-password') router.replace('/change-password'); else if (session && !session.user.mustChangePassword && (isLoginPath || path === '/change-password')) router.replace(dashboardPathFor(session)); }, [loading, path, router, session]);
  const login = async (identifier: string, password: string) => { const result = await authApi.login(identifier, password); const me = await authApi.me(result.token); const next: Session = { token: result.token, user: { ...result.user, ...me.user }, roles: me.roles, permissions: me.permissions }; localStorage.setItem(KEY, JSON.stringify(next)); setSession(next); return result.requiresPasswordChange; };
  const value = useMemo(() => ({ session, loading, login, refresh, logout, can: (code: string) => Boolean(session?.permissions.includes(code)) }), [session, loading, logout, refresh]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
export function useAuth() { const value = useContext(AuthContext); if (!value) throw new Error('useAuth must be used inside AuthProvider'); return value; }
