'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { academicNavigation, matchesAcademicRoute } from '../lib/academic-navigation';
export function AcademicBreadcrumbs() {
  const path = usePathname();
  const group = academicNavigation.find(group => group.links.some(link => matchesAcademicRoute(path, link.href)));
  const link = group?.links.find(link => matchesAcademicRoute(path, link.href));
  if (!group || !link) return null;
  const detail = path !== link.href;
  return <nav className="academic-breadcrumbs" aria-label="Breadcrumb"><span>Academics</span>{group.label !== link.label && <><span aria-hidden="true">/</span><span>{group.label}</span></>}<span aria-hidden="true">/</span>{detail ? <><Link href={link.href}>{link.label}</Link><span aria-hidden="true">/</span><span aria-current="page">Section workspace</span></> : <span aria-current="page">{link.label}</span>}</nav>;
}
