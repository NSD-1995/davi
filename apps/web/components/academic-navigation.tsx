'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { BookOpen, CalendarDays, ChevronDown, Circle, GraduationCap, Settings2 } from 'lucide-react';
import { matchesAcademicRoute, visibleAcademicNavigation } from '../lib/academic-navigation';
import { useAuth } from '../lib/auth-context';
const icons = { workspace: GraduationCap, planning: BookOpen, timetable: CalendarDays, setup: Settings2 };
export function AcademicNavigation({ path, onNavigate }: { path: string; onNavigate: () => void }) {
  const { can, session } = useAuth();
  const groups = visibleAcademicNavigation(can);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const storageKey = `davi:academic-nav:${session?.user.school?.id}:${session?.user.id}`;
  useEffect(() => { try { setExpanded(JSON.parse(localStorage.getItem(storageKey) || '{}')); } catch { setExpanded({}); } }, [storageKey]);
  useEffect(() => {
    const active = groups.find(group => group.links.some(link => matchesAcademicRoute(path, link.href)));
    if (active) setExpanded(previous => ({ ...previous, [active.icon]: true }));
  }, [path, session]);
  if (!groups.length) return null;
  return <div className="nav-group academic-navigation"><p>Academics</p>{groups.map(group => {
    const Icon = icons[group.icon];
    const active = group.links.some(link => matchesAcademicRoute(path, link.href));
    if (group.icon === 'workspace') return <Link key={group.icon} title={group.label} href={group.links[0].href} className={active ? 'active' : ''} aria-current={active ? 'page' : undefined} onClick={onNavigate}><Icon size={18}/><span className="nav-label">{group.label}</span></Link>;
    const open = expanded[group.icon] ?? active;
    return <div className="academic-nav-branch" key={group.icon}>
      <button className={`nav-disclosure ${active ? 'branch-active' : ''}`} title={group.label} aria-expanded={open} aria-controls={`academic-nav-${group.icon}`} onClick={() => {
        const next = { ...expanded, [group.icon]: !open }; setExpanded(next);
        try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch { /* Navigation also works without storage. */ }
      }}><Icon size={18}/><span className="nav-label">{group.label}</span><ChevronDown size={15} className={open ? 'chevron expanded' : 'chevron'}/></button>
      <div id={`academic-nav-${group.icon}`} className="academic-nav-children" hidden={!open}>{group.links.map(link => {
        const current = matchesAcademicRoute(path, link.href);
        return <Link key={link.href} title={link.advanced ? `${link.label} — advanced configuration` : link.label} href={link.href} aria-current={current ? 'page' : undefined} className={`${current ? 'active' : ''} ${link.advanced ? 'advanced-link' : ''}`} onClick={onNavigate}><span className="nav-label">{link.label}</span>{link.advanced ? <Settings2 size={14} aria-label="Advanced configuration"/> : <Circle size={14} className="nav-child-icon" aria-hidden="true"/>}</Link>;
      })}</div>
    </div>;
  })}</div>;
}
