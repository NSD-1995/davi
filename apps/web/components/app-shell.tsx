'use client';
import {TeacherCheckIn} from './teacher-check-in';
import {NotificationBell} from './notification-bell';
import Link from 'next/link';
import { AcademicNavigation } from './academic-navigation';
import { AcademicBreadcrumbs } from './academic-breadcrumbs';
import { PanelLeftClose, PanelLeftOpen, X } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { Fragment, useEffect, useRef, useState, type ReactNode } from 'react';
import { isSuperAdmin, useAuth } from '../lib/auth-context';
import { AcademicYearSelector } from './academic-year-selector';

const schoolGroups = [
  { label: '', links: [{ href: '/dashboard', label: 'Dashboard', icon: '⌂', permission: '' }] },
  { label: 'School', links: [{ href: '/school/profile', label: 'School Profile', icon: '▣', permission: 'SCHOOL_PROFILE_VIEW' }, { href: '/school/settings', label: 'Settings', icon: '⚙', permission: 'SCHOOL_PROFILE_VIEW' }] },
  { label: 'School Operations', links: [{ href:'/operations',label:'Daily Overview',icon:'O',permission:'operations.dashboard.view' },{ href:'/operations/attendance',label:'Staff Attendance',icon:'A',permission:'staff.attendance.view' },{ href:'/operations/attendance-settings',label:'Attendance Settings',icon:'A',permission:'staff.attendance.policy.manage' },{ href:'/operations/leave-policies',label:'Leave Policies',icon:'L',permission:'staff.leave.policy.manage' },{ href:'/operations/leave',label:'Leave Management',icon:'L',permission:'staff.leave.approve' },{ href:'/operations/duties',label:'Daily Duties',icon:'D',permission:'operations.tasks.manage' },{ href:'/people/teacher-attendance',label:'Substitution Planner',icon:'S',permission:'timetable.substitution.view' },{ href:'/operations/reports',label:'Attendance Reports',icon:'R',permission:'staff.attendance.view' }] },
  { label: 'Access Management', links: [{ href: '/access/roles', label: 'Roles & Permissions', icon: '◉', permission: 'ROLE_VIEW' }, { href: '/people/staff', label: 'Staff', icon: '♙', permission: 'STAFF_VIEW' }, { href: '/people/teacher-attendance', label: 'Teacher Attendance & Cover', icon: '✓', permission: 'ATTENDANCE_VIEW' }] },
  { label: 'Admissions', links: [
    {href:'/admissions/dashboard',label:'Admissions Overview',icon:'A',permission:'ADMISSIONS_VIEW'},
    {href:'/admissions/enquiries',label:'Enquiries',icon:'E',permission:'ADMISSIONS_VIEW'},
    {href:'/admissions/follow-ups',label:'Follow-ups',icon:'F',permission:'ADMISSIONS_VIEW'},
    {href:'/admissions/applications',label:'Applications',icon:'A',permission:'ADMISSIONS_VIEW'},
    {href:'/admissions/decisions',label:'Admission Decisions',icon:'D',permission:'ADMISSIONS_VIEW'},
    {href:'/admissions/joining',label:'Joined / Not Joined',icon:'J',permission:'ADMISSIONS_VIEW'},
    {href:'/admissions/settings',label:'Admission Settings',icon:'S',permission:'ADMISSIONS_SETTINGS_MANAGE'},
  ]},
  { label: 'Students', links: [
    {href:'/people/students',label:'Student Directory',icon:'S',permission:'STUDENT_VIEW'},
    {href:'/students/unassigned',label:'Unassigned Students',icon:'U',permission:'STUDENT_VIEW'},
    {href:'/students/allocation',label:'Class & Section Allocation',icon:'A',permission:'ENROLLMENT_ALLOCATE'},
    {href:'/students/transfers',label:'Transfers & Swaps',icon:'T',permission:'ENROLLMENT_MOVE'},
    {href:'/students/promotions',label:'Promotions',icon:'P',permission:'ENROLLMENT_PROMOTE'},
  ]},
  { label: 'People', links: [{ href: '/people/parents', label: 'Parents', icon: '♥', permission: 'PARENT_VIEW' }] },
];

export function AppShell({ children }: { children: ReactNode }) {
  const path = usePathname();
  const { session, logout, can } = useAuth();
  const [open, setOpen] = useState(false);
  const [compact, setCompact] = useState(false);
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
  const name = `${session?.user.firstName || ''} ${session?.user.lastName || ''}`.trim();
  return <div className={`app-shell ${compact ? 'sidebar-compact' : ''}`}>
    {open && <button className="scrim" onClick={() => setOpen(false)} aria-label="Close navigation" />}
    <aside ref={sidebarRef} id="primary-sidebar" aria-label="Main navigation" onKeyDown={e => { if(e.key === 'Escape') setOpen(false);
      if(open && e.key === 'Tab') {
        const items = Array.from(e.currentTarget.querySelectorAll<HTMLElement>('a,button')).filter(item => item.getClientRects().length);
        const first = items[0], last = items[items.length-1];
        if(e.shiftKey && document.activeElement === first){e.preventDefault();last?.focus();}
        else if(!e.shiftKey && document.activeElement === last){e.preventDefault();first?.focus();}
      } }} className={open ? 'sidebar open' : 'sidebar'}>
      <div className="brand"><span className="brand-mark">D</span><div><strong>DAVI</strong><small>{platformAdmin ? 'Super Admin' : 'School Admin'}</small></div></div>
      <button className="sidebar-collapse" aria-label={compact ? 'Expand sidebar' : 'Collapse sidebar'} onClick={() => setCompact(!compact)}>{compact ? <PanelLeftOpen size={18}/> : <PanelLeftClose size={18}/>}</button><button className="sidebar-mobile-close" aria-label="Close navigation" onClick={() => setOpen(false)}><X size={20}/></button>
      <nav aria-label="Primary">{groups.map(group => <Fragment key={group.label || 'main'}>{group.label === 'School Operations' && !platformAdmin && <AcademicNavigation path={path} onNavigate={() => setOpen(false)}/ >}<div className="nav-group">{group.label && <p>{group.label}</p>}{group.links.filter(link => can(link.permission)&&(!link.href.startsWith('/admissions/')||can('ADMISSIONS_VIEW'))&&(!link.href.startsWith('/students/')||can('STUDENT_VIEW'))&&(link.href!=='/people/teacher-attendance'||can('STAFF_VIEW')||can('timetable.substitution.view'))).map(link => <Link key={link.href} title={link.label} aria-current={path === link.href ? 'page' : undefined} href={link.href} onClick={() => setOpen(false)} className={path === link.href ? 'active' : ''}><span>{link.icon}</span><span className="nav-label">{link.label}</span></Link>)}</div></Fragment>)}</nav>
      <button className="logout" title="Logout" aria-label="Logout" onClick={logout}><span>↪</span> Logout</button>
    </aside>
    <div className="main-column">
      <header className="topbar"><button className="menu-button" aria-label="Open navigation" aria-expanded={open} aria-controls="primary-sidebar" onClick={() => setOpen(true)}>☰</button><div className="school-title"><strong>{platformAdmin ? 'DAVI Platform' : school?.name || 'Your School'}</strong><small>{platformAdmin ? 'Super Admin Portal' : 'Administration Portal'}</small></div><div className="topbar-actions"><TeacherCheckIn/><NotificationBell/>{!platformAdmin && <AcademicYearSelector />}<div className="avatar">{(session?.user.firstName?.[0] || 'U').toUpperCase()}</div><div className="user-name"><strong>{name || (platformAdmin ? 'Super Admin' : 'School Admin')}</strong><small>{session?.roles[0]?.name || 'User'}</small></div><button className="icon-button" onClick={logout} title="Logout">↪</button></div></header>
      <main className={`content ${path.startsWith('/academics/') || path.startsWith('/people/teachers') || path.startsWith('/admissions') || path.startsWith('/students/') ? 'academics-content' : ''}`}><AcademicBreadcrumbs/>{children}</main>
    </div>
  </div>;
}
