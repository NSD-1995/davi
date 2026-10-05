'use client';
import type { ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { AppShell } from '../../components/app-shell';
import { LoadingState } from '../../components/ui';
import { isSuperAdmin, useAuth } from '../../lib/auth-context';

const routePermissions: Record<string, string> = { '/school/profile': 'SCHOOL_PROFILE_VIEW', '/school/settings': 'SCHOOL_PROFILE_VIEW', '/academics/academic-years': 'ACADEMIC_YEAR_VIEW', '/academics/classes': 'CLASS_VIEW', '/academics/subjects': 'SUBJECT_VIEW', '/academics/ai-lesson-plans': 'LESSON_PLAN_VIEW', '/academics/academic-planner': 'LESSON_PLAN_VIEW', '/access/roles': 'ROLE_VIEW', '/people/staff': 'STAFF_VIEW', '/people/teachers': 'STAFF_VIEW', '/people/students': 'STUDENT_VIEW', '/people/parents': 'PARENT_VIEW' };

export default function AdminLayout({ children }: { children: ReactNode }) {
  const { session, loading, can } = useAuth();
  const path = usePathname();
  const router = useRouter();
  const required = Object.entries(routePermissions).find(([prefix]) => path === prefix || path.startsWith(`${prefix}/`))?.[1];
  const wrongPlatformRoute = Boolean(session && isSuperAdmin(session) && path !== '/dashboard');
  useEffect(() => {
    if (!loading && session && wrongPlatformRoute) router.replace('/dashboard');
    else if (!loading && session && required && !can(required)) router.replace('/forbidden');
  }, [can, loading, required, router, session, wrongPlatformRoute]);
  if (loading || !session || session.user.mustChangePassword || wrongPlatformRoute || (required && !can(required))) return <div className="screen-center"><LoadingState label="Loading your workspace…" /></div>;
  return <AppShell>{children}</AppShell>;
}
