'use client';
import Link from 'next/link';
import { useId, useMemo, useState } from 'react';
import { ArrowUpRight, ChevronDown, LayoutGrid, List, Search } from 'lucide-react';
import { filterWorkspaceClasses, sectionWorkspaceHref, workspaceAttendance } from '../lib/workspace-list';
import { useAuth } from '../lib/auth-context';
import { StatusBadge } from './ui';
import type { ClassWorkspace, WorkspaceSection } from '../lib/types';

function ClassTeacher({ section }: { section: WorkspaceSection }) {
  const { can } = useAuth();
  const teacher = section.classTeacherDetails;
  const name = teacher && [teacher.firstName, teacher.lastName].filter(Boolean).join(' ').trim();
  return <div className="workspace-class-teacher"><span>Class teacher</span>{teacher && name ? can('STAFF_VIEW') ? <Link className="record-link" title={name} href={'/people/teachers/' + teacher.id}>{name}</Link> : <strong title={name}>{name}</strong> : <strong className="workspace-teacher-missing">Not assigned</strong>}{teacher?.teacherCode && <small className="workspace-teacher-code">{teacher.teacherCode}</small>}</div>;
}

function TodayAttendance({ section }: { section: WorkspaceSection }) {
  const attendance = workspaceAttendance(section);
  const counts = section.todayAttendance;
  return <div className="workspace-today"><div><span>Today’s attendance</span><span className={`workspace-attendance workspace-attendance-${attendance.tone}`}>{attendance.label}</span></div><small>{attendance.detail}{attendance.recorded > 0 && counts && <span className="workspace-attendance-counts"> · {counts.present} present · {counts.absent} absent{counts.late > 0 ? ` · ${counts.late} late` : ''}</span>}</small></div>;
}

function StudentsAndCapacity({ section }: { section: WorkspaceSection }) {
  return <span><strong>{section.studentCount}</strong> students <span className="workspace-capacity">/ {section.capacity === null || section.capacity === undefined ? 'capacity not set' : `${section.capacity} seats`}</span></span>;
}

function OpenWorkspace({ classId, className, section, yearId }: { classId: string; className: string; section: WorkspaceSection; yearId: string }) {
  return <Link className="workspace-open" href={sectionWorkspaceHref(classId, section.id, yearId)} aria-label={`Open workspace for ${className}, section ${section.name}`}><span>Open Workspace</span><ArrowUpRight size={14} aria-hidden="true"/></Link>;
}

export function WorkspaceClassList({ rows, yearId }: { rows: ClassWorkspace[]; yearId: string }) {
  const { can } = useAuth();
  const [search, setSearch] = useState('');
  const [view, setView] = useState<'cards' | 'table'>('cards');
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const id = useId();
  const filtered = useMemo(() => filterWorkspaceClasses(rows, search), [rows, search]);
  const matchingSections = filtered.reduce((sum, item) => sum + item.sections.length, 0);
  const searching = Boolean(search.trim());
  const toggle = (classId: string) => setCollapsed(previous => {
    const next = new Set(previous);
    if (next.has(classId)) next.delete(classId); else next.add(classId);
    return next;
  });
  return <div className="workspace-directory">
    <div className="workspace-directory-toolbar">
      <label className="workspace-directory-search"><Search size={16} aria-hidden="true"/><span className="workspace-sr-only">Search classes, sections or class teachers</span><input type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search class, section or teacher"/></label>
      <div className="workspace-view-switch" role="group" aria-label="Workspace view"><button type="button" aria-pressed={view === 'cards'} onClick={() => setView('cards')}><LayoutGrid size={15} aria-hidden="true"/>Cards</button><button type="button" aria-pressed={view === 'table'} onClick={() => setView('table')}><List size={15} aria-hidden="true"/>Table</button></div>
      <button className="text-button workspace-collapse-all" disabled={searching || !filtered.length} title={searching ? 'Clear search to collapse groups' : undefined} onClick={() => setCollapsed(filtered.every(item => collapsed.has(item.id)) ? new Set() : new Set(filtered.map(item => item.id)))}>{filtered.length > 0 && filtered.every(item => collapsed.has(item.id)) ? 'Expand all' : 'Collapse all'}</button>
    </div>
    <p className="workspace-directory-results" role="status">{filtered.length} {filtered.length === 1 ? 'class' : 'classes'} · {matchingSections} {matchingSections === 1 ? 'section' : 'sections'}{searching ? ' match your search' : ''}</p>
    {!filtered.length ? <div className="workspace-directory-empty"><h2>No matching classes or sections</h2><p>Try a class name, section name or class teacher.</p><button className="button secondary" onClick={() => setSearch('')}>Clear search</button></div> : filtered.map(item => {
      // Searching reveals matches without changing the user's saved collapse choices.
      const expanded = searching || !collapsed.has(item.id);
      const regionId = `${id}-sections-${item.id}`;
      return <section className="workspace-class-group" key={item.id} aria-labelledby={`${regionId}-heading`}>
        <header className="workspace-class-heading"><div className="workspace-class-heading-main"><h2 id={`${regionId}-heading`}><button className="workspace-class-toggle" aria-expanded={expanded} aria-controls={regionId} onClick={() => toggle(item.id)} disabled={searching}>
          <ChevronDown size={16} className={expanded ? '' : 'is-collapsed'} aria-hidden="true"/><span>{item.name}</span></button></h2><span className="workspace-class-total">{item.code && <span className="workspace-class-code">{item.code} &#183; </span>}{item.sectionCount} {item.sectionCount === 1 ? 'section' : 'sections'}<span aria-hidden="true"> · </span>{item.studentCount} students{searching && item.sections.length !== item.sectionCount ? ` · ${item.sections.length} shown` : ''}{!!item.unassignedStudentCount && ` · ${item.unassignedStudentCount} unassigned`}</span></div>{item.status && item.status !== 'ACTIVE' && <StatusBadge status={item.status}/>}</header>
        <div id={regionId} hidden={!expanded}>
          {!item.sections.length ? <div className="workspace-no-sections"><span>No sections yet. Add a section in Classes & Sections.</span>{can('CLASS_VIEW') && <Link className="text-button" href="/academics/classes">Manage class</Link>}</div> : view === 'cards' ? <div className="workspace-section-grid">{item.sections.map(section => <article className="workspace-section-card" key={section.id}>
            <header><div><h3 title={'Section '+section.name}>Section {section.name}</h3><span className="workspace-room">{section.room ? `Room ${section.room}` : 'Room not set'}</span></div>{section.status && section.status !== 'ACTIVE' && <StatusBadge status={section.status}/>}</header>
            <ClassTeacher section={section}/>
            <div className="workspace-section-numbers"><StudentsAndCapacity section={section}/><small>{section.subjectTeacherCount} subject {section.subjectTeacherCount === 1 ? 'teacher' : 'teachers'}</small></div>
            <TodayAttendance section={section}/>
            <footer><OpenWorkspace className={item.name} classId={item.id} section={section} yearId={yearId}/></footer>
          </article>)}</div> : <div className="table-wrap workspace-section-table" role="region" aria-label={`${item.name} sections`} tabIndex={0}><table><thead><tr><th scope="col">Section</th><th scope="col">Class teacher</th><th scope="col">Students / capacity</th><th scope="col">Subject teachers</th><th scope="col">Today’s attendance</th><th scope="col">Workspace</th></tr></thead><tbody>{item.sections.map(section => <tr key={section.id}>
            <th scope="row"><strong>Section {section.name}</strong><small>{section.room ? `Room ${section.room}` : 'Room not set'}</small>{section.status && section.status !== 'ACTIVE' && <StatusBadge status={section.status}/>}</th><td><ClassTeacher section={section}/></td><td><StudentsAndCapacity section={section}/></td><td>{section.subjectTeacherCount}</td><td><TodayAttendance section={section}/></td><td><OpenWorkspace className={item.name} classId={item.id} section={section} yearId={yearId}/></td>
          </tr>)}</tbody></table></div>}
        </div>
      </section>;
    })}
  </div>;
}
