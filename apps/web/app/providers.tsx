'use client';

import type { ReactNode } from 'react';
import { AuthProvider } from '../lib/auth-context';
import { AcademicYearProvider } from '../lib/academic-year-context';
import { SchoolAcademicGroupsProvider } from '../lib/school-academic-groups-context';
import { ToastProvider } from '../lib/toast-context';

export function AppProviders({ children }: { children: ReactNode }) {
  return <ToastProvider><AuthProvider><AcademicYearProvider><SchoolAcademicGroupsProvider>{children}</SchoolAcademicGroupsProvider></AcademicYearProvider></AuthProvider></ToastProvider>;
}
