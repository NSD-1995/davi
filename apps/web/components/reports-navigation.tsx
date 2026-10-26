'use client';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { LayoutDashboard, Layers3, GraduationCap, Activity, HeartHandshake, Building2 } from 'lucide-react';
import { permittedReportPages, reportLocation, reportHref } from '../lib/analytics-navigation';
import { useAuth } from '../lib/auth-context';
const icons: Record<string,typeof LayoutDashboard> = {overview:LayoutDashboard,classes:Layers3,academic:GraduationCap,engagement:Activity,attention:HeartHandshake,operations:Building2};
export function ReportsNavigation({path,onNavigate}:{path:string;onNavigate:()=>void}) {
 const {can}=useAuth();const params=useSearchParams();const pages=permittedReportPages(can);
 if(!pages.length)return null;
 const active=path.startsWith('/reports/analytics');const location=reportLocation(params.get('view')||'overview',params.get('subview')||undefined);
 return <div className="nav-group reports-primary"><p>Reports & Analytics</p>{pages.map(page=>{
  const Icon=icons[page.key]; const selected=active&&location.page===page.key;
  return <Link key={page.key} href={'/reports/analytics?'+reportHref(page.views[0])} title={page.label} aria-current={selected?'page':undefined} className={selected?'active':''} onClick={onNavigate}><Icon size={18} aria-hidden="true"/><span className="nav-label">{page.label}</span></Link>;
 })}</div>;
}
