'use client';
import { Suspense, type ReactNode } from 'react';
import { AppShell } from '../../components/app-shell';
import { LoadingState } from '../../components/ui';
import { useAuth } from '../../lib/auth-context';
export default function ParentLayout({children}:{children:ReactNode}){const {session,loading}=useAuth();if(loading||!session||session.user.mustChangePassword)return <LoadingState label="Loading your school workspace…"/>;return <Suspense fallback={<LoadingState/>}><AppShell>{children}</AppShell></Suspense>;}
