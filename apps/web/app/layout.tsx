import { PwaRuntime } from '../components/pwa-runtime';
import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import './globals.css';
import './dashboard.css';
import './command-center.css';
import './academics.css';
import './reports.css';
import './timetable-workspace.css';
import './school-profile.css';
import './app-shell.css';
import './school-experience.css';
import { AppProviders } from './providers';
import { schoolMetadata, siteOrigin } from '../lib/school-metadata';
import { getPublicSchoolIdentity } from '../lib/school-metadata';
import { headers } from 'next/headers';

export const viewport:Viewport={width:'device-width',initialScale:1,viewportFit:'cover',themeColor:'#123f52'};
export async function generateMetadata({ params }: { params: { schoolSlug?: string } }): Promise<Metadata> {
  const slug = params.schoolSlug || headers().get('x-davi-school-slug');
  if (slug) {
    const school = await getPublicSchoolIdentity(slug);
    return { ...schoolMetadata(siteOrigin(), school, slug), title: school ? `${school.name} School Workspace` : 'School Workspace' };
  }
  return { ...schoolMetadata(siteOrigin()), manifest: '/manifest.webmanifest' };
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body><AppProviders>{children}<PwaRuntime/></AppProviders></body>
    </html>
  );
}
