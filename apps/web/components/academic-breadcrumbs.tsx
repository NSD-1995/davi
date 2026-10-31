'use client';
import Link, { usePathname, useSearchParams } from '../lib/school-navigation';
import { sidebarDestination } from '../lib/sidebar-navigation';
export function AcademicBreadcrumbs() {
  const path=usePathname(),params=useSearchParams();
  const destination=sidebarDestination(path,params.toString());
  if(path==='/dashboard'||!destination)return null;
  const {group,link}=destination;
  const detail=path!==link.href.split('?')[0]&&!link.aliases?.includes(path);
  const detailLabel=path.startsWith('/academics/workspace/')?'Section workspace':path.startsWith('/people/teachers/')?'Teacher details':path.startsWith('/people/students/')?'Student details':path.startsWith('/people/parents/')?'Parent details':'Details';
  return <nav className="academic-breadcrumbs" aria-label="Breadcrumb">{group.label===link.label&&detail?<Link href={link.href}>{group.label}</Link>:<span aria-current={group.label===link.label&&!detail?'page':undefined}>{group.label}</span>}{group.label!==link.label&&<><span aria-hidden="true">/</span>{detail?<Link href={link.href}>{link.label}</Link>:<span aria-current="page">{link.label}</span>}</>}{detail&&<><span aria-hidden="true">/</span><span aria-current="page">{detailLabel}</span></>}</nav>;
}
