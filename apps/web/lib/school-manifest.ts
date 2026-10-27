import type { MetadataRoute } from 'next';
import type { PublicSchoolIdentity } from './school-metadata';
import { safeColor } from './school-brand';

export function schoolManifest(school: PublicSchoolIdentity): MetadataRoute.Manifest {
  const base = `/school/${encodeURIComponent(school.slug)}`;
  const icon = `${base}/app-icon`;
  return {
    id: `${base}/`,
    name: `${school.name} School Workspace`,
    short_name: `${school.name} Workspace`,
    description: `The dedicated school workspace for ${school.name}.`,
    start_url: `${base}/login`,
    scope: `${base}/`,
    display: 'standalone',
    background_color: '#f5f7f9',
    theme_color: safeColor(school.branding?.primary, '#123f52'),
    icons: [192, 512].map(size => ({ src: `${icon}?size=${size}`, sizes: `${size}x${size}`, type: 'image/png', purpose: 'any' as const })),
  };
}
