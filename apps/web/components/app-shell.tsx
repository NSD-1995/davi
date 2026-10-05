'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import { isSuperAdmin, useAuth } from '../lib/auth-context';
import { AcademicYearSelector } from './academic-year-selector';

const schoolGroups = [
  { label: '', links: [{ href: '/dashboard', label: 'Dashboard', icon: '⌂', permission: '' }] },
  { label: 'School', links: [{ href: '/school/profile', label: 'School Profile', icon: '▣', permission: 'SCHOOL_PROFILE_VIEW' }, { href: '/school/settings', label: 'Settings', icon: '⚙', permission: 'SCHOOL_PROFILE_VIEW' }] },
  { label: 'Academics', links: [{ href: '/academics/academic-years', label: 'Academic Years', icon: '◫', permission: 'ACADEMIC_YEAR_VIEW' }, { href: '/academics/classes', label: 'Classes & Sections', icon: '▤', permission: 'CLASS_VIEW' }, { href: '/academics/workspace', label: 'Class Workspace', icon: '◉', permission: 'CLASS_VIEW' }, { href: '/academics/subjects', label: 'Subjects', icon: '◇', permission: 'SUBJECT_VIEW' }, { href: '/academics/ai-lesson-plans', label: 'Syllabus & AI Plans', icon: '✦', permission: 'LESSON_PLAN_VIEW' }, { href: '/academics/academic-planner', label: 'Academic Planner', icon: 'A', permission: 'LESSON_PLAN_VIEW' }, { href: '/academics/period-templates', label: 'Period Templates', icon: '◷', permission: 'PERIOD_TEMPLATE_VIEW' }] },
  { label: 'Access Management', links: [{ href: '/access/roles', label: 'Roles & Permissions', icon: '◉', permission: 'ROLE_VIEW' }, { href: '/people/staff', label: 'Staff', icon: '♙', permission: 'STAFF_VIEW' }, { href: '/people/teachers', label: 'Teachers', icon: '♞', permission: 'STAFF_VIEW' }] },
  { label: 'People', links: [{ href: '/people/students', label: 'Students', icon: '◉', permission: 'STUDENT_VIEW' }, { href: '/people/parents', label: 'Parents', icon: '♥', permission: 'PARENT_VIEW' }] },
];

export function AppShell({ children }: { children: ReactNode }) {
  const path = usePathname();
  const { session, logout, can } = useAuth();
  const [open, setOpen] = useState(false);
  const platformAdmin = isSuperAdmin(session);
  const groups = platformAdmin ? [{ label: 'Platform', links: [{ href: '/dashboard', label: 'Schools', icon: '▣', permission: '' }] }] : schoolGroups;
  const school = session?.user.school;
  const name = `${session?.user.firstName || ''} ${session?.user.lastName || ''}`.trim();
  return <div className="app-shell">
    {open && <button className="scrim" onClick={() => setOpen(false)} aria-label="Close navigation" />}
    <aside className={open ? 'sidebar open' : 'sidebar'}>
      <div className="brand"><span className="brand-mark">D</span><div><strong>DAVI</strong><small>{platformAdmin ? 'Super Admin' : 'School Admin'}</small></div></div>
      <nav>{groups.map(group => <div className="nav-group" key={group.label || 'main'}>{group.label && <p>{group.label}</p>}{group.links.filter(link => can(link.permission)).map(link => <Link key={link.href} href={link.href} onClick={() => setOpen(false)} className={path === link.href ? 'active' : ''}><span>{link.icon}</span>{link.label}</Link>)}</div>)}</nav>
      <button className="logout" onClick={logout}><span>↪</span> Logout</button>
    </aside>
    <div className="main-column">
      <header className="topbar"><button className="menu-button" onClick={() => setOpen(true)}>☰</button><div className="school-title"><strong>{platformAdmin ? 'DAVI Platform' : school?.name || 'Your School'}</strong><small>{platformAdmin ? 'Super Admin Portal' : 'Administration Portal'}</small></div><div className="topbar-actions">{!platformAdmin && <AcademicYearSelector />}<div className="avatar">{(session?.user.firstName?.[0] || 'U').toUpperCase()}</div><div className="user-name"><strong>{name || (platformAdmin ? 'Super Admin' : 'School Admin')}</strong><small>{session?.roles[0]?.name || 'User'}</small></div><button className="icon-button" onClick={logout} title="Logout">↪</button></div></header>
      <main className="content">{children}</main>
    </div>
  </div>;
}
