'use client';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { authApi, onUnauthorized, schoolExperienceApi } from './api';
import { schoolRoute, scopedHref, isWorkspacePath } from './school-routes';
import type { Session } from './types';

const KEY = 'davi_session';
export function isSuperAdmin(session: Session | null) { return Boolean(session?.roles.some(role => role.code.toUpperCase() === 'SUPER_ADMIN')); }
export function dashboardPathFor(session: Session | null) { if (isSuperAdmin(session)) return '/dashboard'; const roles=session?.roles.map(r=>r.code.toUpperCase())||[]; if(roles.includes('PARENT')&&!roles.includes('SCHOOL_ADMIN')&&!roles.includes('TEACHER'))return scopedHref('/parent/learning',session?.user.school?.slug||null); return session?.user.school?.slug ? `/school/${session.user.school.slug}/dashboard` : '/dashboard'; }
interface AuthValue { session: Session | null; loading: boolean; login: (identifier: string, password: string, schoolSlug?: string) => Promise<boolean>; refresh: () => Promise<void>; logout: () => void; can: (code: string) => boolean }
const AuthContext = createContext<AuthValue | null>(null);
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null); const [loading, setLoading] = useState(true); const router = useRouter(); const path = usePathname();
  const logout = useCallback(() => { const slug=session?.user.school?.slug||schoolRoute(path).slug; localStorage.removeItem(KEY); setSession(null); router.replace(slug?`/school/${slug}/login`:'/login'); }, [router,session?.user.school?.slug,path]);
  const refresh = useCallback(async () => { const raw = localStorage.getItem(KEY); if (!raw) { setLoading(false); return; } try { const stored = JSON.parse(raw) as Session; const me = await authApi.me(stored.token); const next = { ...stored, ...me, user: { ...stored.user, ...me.user } }; localStorage.setItem(KEY, JSON.stringify(next)); setSession(next); } catch { localStorage.removeItem(KEY); setSession(null); } finally { setLoading(false); } }, []);
  useEffect(() => { void refresh(); }, [refresh]); useEffect(() => onUnauthorized(logout), [logout]);
  const route = schoolRoute(path);
  const expectedSlug = session?.user.school?.slug || null;
  const wrongSchool = Boolean(session && route.slug && (isSuperAdmin(session) || route.slug !== expectedSlug));
  useEffect(() => {
    if (loading) return;
    const loginPath = path === '/login' || route.path === '/login';
    if (!session) { if (!loginPath) router.replace(route.slug ? '/school/'+route.slug+'/login' : '/login'); return; }
    if (wrongSchool) { let active=true; if(!isSuperAdmin(session)&&route.slug&&expectedSlug){schoolExperienceApi.publicSchool(route.slug).then(s=>{if(active)router.replace(s.slug===expectedSlug?scopedHref(route.path,expectedSlug)+window.location.search+window.location.hash:dashboardPathFor(session));}).catch(()=>{if(active)router.replace(dashboardPathFor(session));});}else router.replace(dashboardPathFor(session));return()=>{active=false;}; }
    if (session.user.mustChangePassword) { if (route.path !== '/change-password') router.replace(scopedHref('/change-password',expectedSlug)); return; }
    if (loginPath || route.path === '/change-password') { router.replace(dashboardPathFor(session)); return; }
    if (!isSuperAdmin(session) && expectedSlug && !route.slug && isWorkspacePath(path)) {
      router.replace(scopedHref(path,expectedSlug)+window.location.search+window.location.hash);
    }
  }, [loading,path,router,session,wrongSchool,expectedSlug,route.slug,route.path]);

  const login = async (identifier: string, password: string, schoolSlug?: string) => { const result = await authApi.login(identifier, password, schoolSlug); const me = await authApi.me(result.token); const next: Session = { token: result.token, user: { ...result.user, ...me.user }, roles: me.roles, permissions: me.permissions }; localStorage.setItem(KEY, JSON.stringify(next)); setSession(next); return result.requiresPasswordChange; };
  const value = useMemo(() => ({ session, loading: loading || wrongSchool, login, refresh, logout, can: (code: string) => !code || Boolean(session?.permissions.includes(code)) }), [session, loading, wrongSchool, logout, refresh]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
export function useAuth() { const value = useContext(AuthContext); if (!value) throw new Error('useAuth must be used inside AuthProvider'); return value; }
