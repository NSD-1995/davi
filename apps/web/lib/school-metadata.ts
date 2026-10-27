import { cache } from 'react';
import type { Metadata } from 'next';
import { headers } from 'next/headers';

export type PublicSchoolIdentity = {
  name: string;
  shortName?: string;
  slug: string;
  branding?: { primary?: string; accent?: string; logoId?: string; iconId?: string };
};

const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';

// Only the public school identity endpoint is used; never fetch account records.
export const getPublicSchoolIdentity = cache(async (slug: string): Promise<PublicSchoolIdentity | null> => {
  if (!slug || slug.length > 80) return null;
  try {
    const response = await fetch(`${apiUrl}/school-experience/public/${encodeURIComponent(slug)}`, {
      cache: 'no-store', signal: AbortSignal.timeout(4000),
    });
    if (!response.ok) return null;
    const school = await response.json();
    return typeof school.name === 'string' && typeof school.slug === 'string' ? school : null;
  } catch { return null; }
});

export function siteOrigin() {
  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  if (configured) return new URL(configured);
  const requestHeaders = headers();
  const host = requestHeaders.get('host') || 'localhost:3000';
  const protocol = /^(localhost|127\.0\.0\.1)(:|$)/.test(host) ? 'http' : 'https';
  return new URL(`${protocol}://${host}`);
}

export function schoolMetadata(origin: URL, school?: PublicSchoolIdentity | null, requestedSlug?: string): Metadata {
  const name = school?.name || (requestedSlug ? 'School Portal' : 'DAVI School Portal');
  const title = `${name} | School Login`;
  const description = `The dedicated school portal for ${school?.name || 'your school'}. Secure access to academics, attendance, communication and school services for staff and families.`;
  const slug = school?.slug || requestedSlug;
  const path = slug ? `/school/${encodeURIComponent(slug)}/login` : '/login';
  const image = new URL(slug ? '/share-image' : '/images/school-share.png', origin);
  if (slug) image.searchParams.set('school', slug);
  const images = [{ url: image.toString(), width: 1200, height: 630, alt: `${name} — dedicated school portal` }];
  const iconId = school?.branding?.iconId || school?.branding?.logoId;
  return {
    metadataBase: origin,
    title,
    description,
    applicationName: name,
    ...(slug ? { manifest: `/school/${encodeURIComponent(slug)}/manifest.webmanifest` } : {}),
    robots: { index: false, follow: false, googleBot: { index: false, follow: false, noimageindex: true } },
    ...(slug ? { alternates: { canonical: new URL(path, origin).toString() } } : {}),
    openGraph: { type: 'website', locale: 'en_IN', siteName: name, title, description, url: new URL(path, origin).toString(), images },
    twitter: { card: 'summary_large_image', title, description, images },
    icons: {
      icon: iconId ? `${apiUrl}/school-experience/public-media/${encodeURIComponent(iconId)}` : '/icon.svg',
      apple: slug ? `/school/${encodeURIComponent(slug)}/app-icon?size=192` : '/icons/davi-180.png',
    },
    appleWebApp: { capable: true, title: name, statusBarStyle: 'default' },
  };
}
