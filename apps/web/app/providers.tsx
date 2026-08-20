'use client';

import type { ReactNode } from 'react';
import { AuthProvider } from '../lib/auth-context';
import { AcademicYearProvider } from '../lib/academic-year-context';
import { ToastProvider } from '../lib/toast-context';

export function AppProviders({ children }: { children: ReactNode }) {
  return <ToastProvider><AuthProvider><AcademicYearProvider>{children}</AcademicYearProvider></AuthProvider></ToastProvider>;
}
