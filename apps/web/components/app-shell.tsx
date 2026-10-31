'use client';
import { SchoolTheme } from './school-theme';
import { schoolExperienceApi } from '../lib/api';
import {TeacherCheckIn} from './teacher-check-in';
import {NotificationBell} from './notification-bell';
import Link from '../lib/school-navigation';
import { SidebarNavigation } from './sidebar-navigation';
import { AcademicBreadcrumbs } from './academic-breadcrumbs';
import { ChevronLeft, ChevronRight, X, School, Heart, LogOut, Menu, LayoutDashboard, CreditCard, ReceiptText, Sparkles, UsersRound, LifeBuoy, ChartNoAxesCombined, Settings } from 'lucide-react';
import { usePathname } from '../lib/school-navigation';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { isSuperAdmin, useAuth } from '../lib/auth-context';

export function AppShell({ children }: { children: ReactNode }) {
  const path = usePathname();
  const { session, logout, can } = useAuth();
  const [open, setOpen] = useState(false);
  const [compact, setCompact] = useState(false);
  const [branding,setBranding]=useState<{key:string;logo:string}>({key:'',logo:''});
  const [failedLogo,setFailedLogo]=useState('');
  const contextKey=session ? session.user.id+':'+session.user.schoolId : '';
  useEffect(()=>{let active=true;const load=()=>{if(!session?.user.school?.slug)return;schoolExperienceApi.publicSchool(session.user.school.slug).then(row=>{if(active){let logo=row.branding?.logoId?schoolExperienceApi.publicMedia(row.branding.logoId):'';if(!logo)try{const u=new URL(String(row.legacyLogoUrl||''));if(u.protocol==='https:')logo=u.href;}catch{}setBranding({key:contextKey,logo});}}).catch(()=>{});};load();window.addEventListener('davi:branding',load);return()=>{active=false;window.removeEventListener('davi:branding',load);};},[session?.token,contextKey]);
  useEffect(()=>{try{setCompact(localStorage.getItem('davi:sidebar:compact')==='true');}catch{}},[]);
  const sidebarRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const oldOverflow = document.body.style.overflow; document.body.style.overflow = 'hidden';
    sidebarRef.current?.querySelector<HTMLButtonElement>('.sidebar-mobile-close')?.focus();
    return () => { document.body.style.overflow = oldOverflow; previous?.focus(); };
  }, [open]);
  const platformAdmin = isSuperAdmin(session);
  const school = session?.user.school;
  const parentOnly=Boolean(session?.roles.some(r=>r.code.toUpperCase()==='PARENT')&&!session.roles.some(r=>['SCHOOL_ADMIN','TEACHER','SUPER_ADMIN'].includes(r.code.toUpperCase())));
  const logo=branding.key===contextKey&&branding.logo!==failedLogo?branding.logo:'';
  const label=platformAdmin?'DAVI':school?.shortName||school?.name||'DAVI';
  const identity=<><span className="shell-school-logo">{logo?<img src={logo} alt={`${label} logo`} onError={()=>setFailedLogo(logo)}/>:<span>{platformAdmin?'D':(school?.shortName?.trim()||label.slice(0,2).toUpperCase())}</span>}</span><span className="shell-school-name"><strong>{label}</strong><small>{platformAdmin?'Platform administration':'School workspace'}</small></span></>;

  const name = `${session?.user.firstName || ''} ${session?.user.lastName || ''}`.trim();
  return <SchoolTheme><div className={`app-shell ${compact ? 'sidebar-compact' : ''}`}><a className="skip-link" href="#main-content">Skip to content</a>
    {open && <button className="scrim" onClick={() => setOpen(false)} aria-label="Close navigation" />}
    <aside ref={sidebarRef} id="primary-sidebar" aria-label="Main navigation" onKeyDown={e => { if(e.key === 'Escape') setOpen(false);
      if(open && e.key === 'Tab') {
        const items = Array.from(e.currentTarget.querySelectorAll<HTMLElement>('a,button,select,input,[tabindex="0"]')).filter(item => item.getClientRects().length);
        const first = items[0], last = items[items.length-1];
        if(e.shiftKey && document.activeElement === first){e.preventDefault();last?.focus();}
        else if(!e.shiftKey && document.activeElement === last){e.preventDefault();first?.focus();}
      } }} className={open ? 'sidebar open' : 'sidebar'}>
      <div className="shell-brand-row">{!platformAdmin&&can('SCHOOL_PROFILE_VIEW')?<Link className="shell-school-identity" href="/school/profile" title={school?.name} onClick={()=>setOpen(false)}>{identity}</Link>:<div className="shell-school-identity" title={school?.name}>{identity}</div>}</div>
      <button className="sidebar-collapse" aria-label={compact ? 'Expand sidebar' : 'Collapse sidebar'} onClick={() => {setCompact(!compact);try{localStorage.setItem('davi:sidebar:compact',String(!compact));}catch{}}}>{compact ? <ChevronRight size={18}/> : <ChevronLeft size={18}/>}</button><button className="sidebar-mobile-close" aria-label="Close navigation" onClick={() => setOpen(false)}><X size={20}/></button>
      {!platformAdmin&&!parentOnly&&<div className="shell-checkin"><TeacherCheckIn/></div>}
      {platformAdmin?<PlatformNavigation path={path} close={()=>setOpen(false)}/>:parentOnly?<nav aria-label="Primary"><div className="nav-group"><Link href="/parent/learning" aria-current={path==='/parent/learning'?'page':undefined} onClick={()=>setOpen(false)}><Heart size={18}/><span className="nav-label">Child learning</span></Link></div></nav>:<SidebarNavigation path={path} compact={compact} onNavigate={()=>setOpen(false)}/>}
      <footer className="shell-account">
        <div className="shell-account-trigger" role="group" aria-label={`${name||'Account'} · ${session?.roles[0]?.name||'User'}`} title={`${name||'Account'} · ${session?.roles[0]?.name||'User'}`}><span className="avatar">{(session?.user.firstName?.[0]||'U').toUpperCase()}</span><span className="shell-account-name"><strong>{name||'Account'}</strong><small>{session?.roles[0]?.name||'User'}</small></span></div>
        <button className="shell-logout" onClick={logout} title="Log out" aria-label="Log out"><LogOut size={18} aria-hidden="true"/></button>
      </footer>
    </aside>
    <NotificationBell/><div className="main-column">
      <header className="shell-mobile-header"><button className="icon-button" aria-label="Open navigation" aria-expanded={open} aria-controls="primary-sidebar" onClick={()=>setOpen(true)}><Menu size={22}/></button><div className="shell-mobile-identity">{identity}</div></header>
      <main id="main-content" className={`content ${path.startsWith('/academics/') || path.startsWith('/people/teachers') || path.startsWith('/admissions') || path.startsWith('/students/') ? 'academics-content' : ''}`}><AcademicBreadcrumbs/>{children}</main>
    </div>
  </div></SchoolTheme>;
}

function PlatformNavigation({path,close}:{path:string;close:()=>void}){const items=[
  ['Dashboard','/davi/dashboard',LayoutDashboard],['Schools','/davi/schools',School],['Subscriptions','/davi/subscriptions',CreditCard],['Billing & payments','/davi/billing',ReceiptText],['AI & usage','/davi/usage',Sparkles],['Platform users','/davi/users',UsersRound],['Requests & support','/davi/support',LifeBuoy],['Analytics & reports','/davi/reports',ChartNoAxesCombined],['Settings','/davi/settings',Settings],
] as const;return <nav aria-label="Platform navigation"><div className="nav-group"><p>Platform</p>{items.map(([label,href,Icon])=><Link key={label} href={href} aria-current={path==='/davi/dashboard'&&label==='Dashboard'?'page':undefined} onClick={close}><Icon size={18}/><span className="nav-label">{label}</span></Link>)}</div></nav>}
