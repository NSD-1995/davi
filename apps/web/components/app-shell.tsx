'use client';
import { SchoolTheme } from './school-theme';
import { schoolSettingsApi,schoolExperienceApi } from '../lib/api';
import {TeacherCheckIn} from './teacher-check-in';
import {NotificationBell} from './notification-bell';
import Link from '../lib/school-navigation';
import { ReportsNavigation } from './reports-navigation';
import { AcademicNavigation } from './academic-navigation';
import { AcademicBreadcrumbs } from './academic-breadcrumbs';
import { ChevronLeft, ChevronRight, X, LayoutDashboard, School, Settings2, CalendarCheck, ClipboardCheck, CalendarClock, ListChecks, Users, ShieldCheck, UserPlus, MessageSquare, BellRing, FileText, GraduationCap, Upload, ArrowLeftRight, TrendingUp, Heart, LogOut, Menu } from 'lucide-react';
import { usePathname } from '../lib/school-navigation';
import { Fragment, useEffect, useRef, useState, type ReactNode } from 'react';
import { isSuperAdmin, useAuth } from '../lib/auth-context';

const schoolGroups = [
  { label: '', links: [{ href: '/dashboard', label: 'Dashboard', icon: '⌂', permission: '' }] },
  { label: 'School', links: [{ href: '/school/profile', label: 'School Profile', icon: '▣', permission: 'SCHOOL_PROFILE_VIEW' }] },
  { label: 'School Operations', links: [{ href:'/operations',label:'Daily Overview',icon:'O',permission:'operations.dashboard.view' },{ href:'/operations/attendance',label:'Staff Attendance',icon:'A',permission:'staff.attendance.view' },{ href:'/operations/attendance-settings',label:'Attendance Settings',icon:'A',permission:'staff.attendance.policy.manage' },{ href:'/operations/leave-policies',label:'Leave Policies',icon:'L',permission:'staff.leave.policy.manage' },{ href:'/operations/leave',label:'Leave Management',icon:'L',permission:'staff.leave.approve' },{ href:'/operations/duties',label:'Daily Duties',icon:'D',permission:'operations.tasks.manage' },{ href:'/people/teacher-attendance',label:'Substitution Planner',icon:'S',permission:'timetable.substitution.view' },{ href:'/operations/reports',label:'Attendance Reports',icon:'R',permission:'staff.attendance.view' }] },
  { label: 'Access Management', links: [{ href: '/access/roles', label: 'Roles & Permissions', icon: '◉', permission: 'ROLE_VIEW' }, { href: '/people/staff', label: 'Staff', icon: '♙', permission: 'STAFF_VIEW' }] },
  { label: 'Admissions', links: [
    {href:'/admissions/dashboard',label:'Admissions Overview',icon:'A',permission:'ADMISSIONS_VIEW'},
    {href:'/admissions/enquiries',label:'Enquiries',icon:'E',permission:'ADMISSIONS_VIEW'},
    {href:'/admissions/follow-ups',label:'Follow-ups',icon:'F',permission:'ADMISSIONS_VIEW'},
    {href:'/admissions/applications',label:'Admissions',icon:'A',permission:'ADMISSIONS_VIEW'},
    {href:'/admissions/settings',label:'Admission Settings',icon:'S',permission:'ADMISSIONS_SETTINGS_MANAGE'},
  ]},
  { label: 'Students', links: [
    {href:'/people/students',label:'Student Directory',icon:'S',permission:'STUDENT_VIEW'},
    {href:'/students/unassigned',label:'Unassigned Students',icon:'U',permission:'STUDENT_VIEW'},
    {href:'/students/import-migration',label:'Student Import',icon:'I',permission:'students.import.view'},
    {href:'/students/allocation',label:'Section Capacity & Allocation',icon:'A',permission:'ENROLLMENT_ALLOCATE'},
    {href:'/students/transfers',label:'Transfers & Swaps',icon:'T',permission:'ENROLLMENT_MOVE'},
    {href:'/students/promotions',label:'Promotions',icon:'P',permission:'ENROLLMENT_PROMOTE'},
  ]},
  { label: 'People', links: [{ href: '/people/parents', label: 'Parents', icon: '♥', permission: 'PARENT_VIEW' }] },
];

const navigationIcons: Record<string, typeof School> = {
  '/dashboard': LayoutDashboard, '/school/profile': School, '/school/settings': Settings2,
  '/operations': LayoutDashboard, '/operations/attendance': CalendarCheck,
  '/operations/attendance-settings': Settings2, '/operations/leave-policies': FileText,
  '/operations/leave': CalendarClock, '/operations/duties': ListChecks,
  '/operations/reports': ClipboardCheck, '/people/teacher-attendance': CalendarClock,
  '/access/roles': ShieldCheck, '/people/staff': Users,
  '/admissions/dashboard': LayoutDashboard, '/admissions/enquiries': MessageSquare,
  '/admissions/follow-ups': BellRing, '/admissions/applications': UserPlus,
  '/admissions/settings': Settings2, '/people/students': GraduationCap,
  '/students/unassigned': Users, '/students/import-migration': Upload,
  '/students/allocation': Users, '/students/transfers': ArrowLeftRight,
  '/students/promotions': TrendingUp, '/people/parents': Heart,
};
function NavigationIcon({ href }: { href: string }) {
  const Icon = navigationIcons[href] || School;
  return <Icon size={18} aria-hidden="true"/>;
}
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
  const groups = platformAdmin ? [{ label: 'Platform', links: [{ href: '/dashboard', label: 'Schools', icon: '▣', permission: '' }] }] : schoolGroups;
  const school = session?.user.school;
  const parentOnly=Boolean(session?.roles.some(r=>r.code.toUpperCase()==='PARENT')&&!session.roles.some(r=>['SCHOOL_ADMIN','TEACHER','SUPER_ADMIN'].includes(r.code.toUpperCase())));
  const logo=branding.key===contextKey&&branding.logo!==failedLogo?branding.logo:'';
  const label=platformAdmin?'DAVI':school?.name||school?.shortName||'DAVI';
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
      <nav aria-label="Primary">{parentOnly?<div className="nav-group"><Link href="/parent/learning" aria-current={path==='/parent/learning'?'page':undefined}><Heart size={18}/><span className="nav-label">Child learning</span></Link></div>:groups.map(group => <Fragment key={group.label || 'main'}>{group.label === 'School Operations' && !platformAdmin && <><AcademicNavigation path={path} onNavigate={() => setOpen(false)}/><ReportsNavigation path={path} onNavigate={()=>setOpen(false)}/></>}<div className="nav-group">{group.label && <p>{group.label}</p>}{group.links.filter(link => (link.href==='/people/teacher-attendance'?(can('timetable.substitution.view')||(can('ATTENDANCE_VIEW')&&can('STAFF_VIEW'))):link.href==='/students/import-migration'?(can('students.import.view')||can('ADMISSIONS_MANAGE')):can(link.permission))&&(!link.href.startsWith('/admissions/')||can('ADMISSIONS_VIEW'))&&(!link.href.startsWith('/students/')||can('STUDENT_VIEW'))&&(link.href!=='/people/teacher-attendance'||can('STAFF_VIEW')||can('timetable.substitution.view'))).map(link => <Link key={link.href} title={link.label} aria-label={link.label} aria-current={path === link.href ? 'page' : undefined} href={link.href} onClick={() => setOpen(false)} className={path === link.href ? 'active' : ''}><NavigationIcon href={link.href}/><span className="nav-label">{link.label}</span></Link>)}</div></Fragment>)}</nav>
      <footer className="shell-account">
        <div className="shell-account-trigger"><span className="avatar">{(session?.user.firstName?.[0]||'U').toUpperCase()}</span><span className="shell-account-name"><strong>{name||'Account'}</strong><small>{session?.roles[0]?.name||'User'}</small></span></div>
        <button className="shell-logout" onClick={logout} title="Log out" aria-label="Log out"><LogOut size={18} aria-hidden="true"/></button>
      </footer>
    </aside>
    <NotificationBell/><div className="main-column">
      <header className="shell-mobile-header"><button className="icon-button" aria-label="Open navigation" aria-expanded={open} aria-controls="primary-sidebar" onClick={()=>setOpen(true)}><Menu size={22}/></button><div className="shell-mobile-identity">{identity}</div></header>
      <main id="main-content" className={`content ${path.startsWith('/academics/') || path.startsWith('/people/teachers') || path.startsWith('/admissions') || path.startsWith('/students/') ? 'academics-content' : ''}`}><AcademicBreadcrumbs/>{children}</main>
    </div>
  </div></SchoolTheme>;
}
