'use client';

import { Fragment, useMemo, useState } from 'react';
import { ChevronDown, MoreHorizontal } from 'lucide-react';
import { ACADEMIC_GROUPS, academicGroup } from '../lib/academic-groups';
import { configuredClassCapacity } from '../lib/class-capacity';
import { useAuth } from '../lib/auth-context';
import type { SchoolClass, Section } from '../lib/types';
import { EmptyState, Field, StatusBadge } from './ui';

interface Props {
  rows: SchoolClass[];
  busy: boolean;
  onEditClass: (row: SchoolClass) => void;
  onSection: (row: SchoolClass, section?: Section) => void;
  onSubjects: (row: SchoolClass) => void;
  onDeleteClass: (row: SchoolClass) => void;
  onDeleteSection: (row: SchoolClass, section: Section) => void;
}
const pageSize = 20;
const groupLabel = (id: string | null) => ACADEMIC_GROUPS.find(group => group.id === id)?.label || id || 'Unassigned';

export function ClassesTable({ rows, busy, onEditClass, onSection, onSubjects, onDeleteClass, onDeleteSection }: Props) {
  const { can } = useAuth();
  const [search, setSearch] = useState('');
  const [group, setGroup] = useState('');
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const groups = useMemo(() => Array.from(new Set(rows.map(row => academicGroup(row) || 'unassigned'))), [rows]);
  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return rows.filter(row => (!group || (academicGroup(row) || 'unassigned') === group) &&
      (!query || [row.name, row.code, ...row.sections.map(section => section.name)].some(value => value?.toLowerCase().includes(query))));
  }, [rows, search, group]);
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, pages);
  const shown = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  function toggle(id: string) {
    setExpanded(previous => { const next = new Set(previous); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  }
  return <section className="card compact-records">
    <div className="academic-table-toolbar">
      <Field label="Search classes or sections"><input type="search" placeholder="Class name, code or section" value={search} onChange={event => { setSearch(event.target.value); setPage(1); }}/></Field>
      <Field label="Academic group"><select value={group} onChange={event => { setGroup(event.target.value); setPage(1); }}><option value="">All academic groups</option>{groups.map(id => <option key={id} value={id}>{groupLabel(id === 'unassigned' ? '' : id)}</option>)}</select></Field>
      <span className="record-count" aria-live="polite">{filtered.length} {filtered.length === 1 ? 'class' : 'classes'}</span>
    </div>
    {!filtered.length ? <EmptyState title="No matching classes" detail="Try another search or academic group." action={<button className="text-button" onClick={() => { setSearch(''); setGroup(''); setPage(1); }}>Clear filters</button>}/> :
      <div className="table-wrap compact-table-wrap"><table className="classes-table"><caption className="visually-hidden">Classes and sections. Expand a class to manage its sections.</caption>
        <thead><tr><th scope="col">Class</th><th scope="col">Academic group</th><th scope="col">Sections</th><th scope="col">Capacity</th><th scope="col">Status</th><th scope="col">Actions</th></tr></thead>
        <tbody>{shown.map(row => {
          const open = expanded.has(row.id);
          const capacity = configuredClassCapacity(row);
          return <Fragment key={row.id}><tr className={`class-summary ${open ? 'is-expanded' : ''}`}>
            <th scope="row"><button className="class-disclosure" aria-expanded={open} aria-controls={`class-sections-${row.id}`} onClick={() => toggle(row.id)}><ChevronDown size={16} className={open ? 'expanded' : ''}/><span><strong>{row.name}</strong>{row.code && <small>{row.code}</small>}</span></button></th>
            <td data-label="Academic group">{groupLabel(academicGroup(row))}</td>
            <td data-label="Sections"><div className="section-chips">{row.sections.slice(0, 4).map(section => <span className="section-chip" key={section.id}>{section.name}</span>)}{row.sections.length > 4 && <span className="section-chip">+{row.sections.length - 4}</span>}{!row.sections.length && <span className="muted">None</span>}</div></td>
            <td data-label="Capacity"><strong>{capacity.value ?? '—'}</strong><small className="cell-detail">{capacity.detail}</small></td>
            <td data-label="Status"><StatusBadge status={row.status}/></td>
            <td data-label="Actions"><button className="text-button" aria-expanded={open} aria-controls={`class-sections-${row.id}`} aria-label={`${open ? 'Close' : 'Manage'} ${row.name}`} onClick={() => toggle(row.id)}>{open ? 'Close' : 'Manage'}</button></td>
          </tr><tr className="class-expanded-row" hidden={!open}><td colSpan={6} id={`class-sections-${row.id}`}>
            {open && <div className="class-section-panel">
              <div className="class-section-toolbar"><h2>{row.name} sections <span className="muted">({row.sections.length})</span></h2><div className="button-row">
                {can('SECTION_CREATE') && <button className="button secondary" disabled={busy} onClick={() => onSection(row)}>+ Add section</button>}
                {can('CLASS_SUBJECT_VIEW') && <button className="button secondary" disabled={busy} onClick={() => onSubjects(row)}>Assign subjects</button>}
                {can('CLASS_UPDATE') && <button className="text-button" disabled={busy} onClick={() => onEditClass(row)}>Edit class</button>}
                {can('CLASS_DELETE') && <details className="record-action-menu"><summary aria-label={`More actions for ${row.name}`} title="More class actions"><MoreHorizontal size={18}/></summary><div><button className="text-button danger-text" disabled={busy} onClick={event => { event.currentTarget.closest('details')?.removeAttribute('open'); onDeleteClass(row); }}>Delete class</button></div></details>}
              </div></div>
              {row.sections.length ? <table className="section-details-table"><caption className="visually-hidden">Sections in {row.name}</caption><thead><tr><th scope="col">Section</th><th scope="col">Seating capacity</th><th scope="col">Status</th><th scope="col">Actions</th></tr></thead><tbody>{row.sections.map(section => <tr key={section.id}>
                <th scope="row">{section.name}</th><td data-label="Seating capacity">{section.capacity ?? 'Not configured'}</td><td data-label="Status"><StatusBadge status={section.status}/></td><td data-label="Actions"><div className="button-row">
                  {can('SECTION_UPDATE') && <button className="text-button" disabled={busy} onClick={() => onSection(row, section)} aria-label={`Edit section ${section.name} in ${row.name}`}>Edit section</button>}
                  {can('SECTION_DELETE') && <details className="record-action-menu"><summary aria-label={`More actions for section ${section.name} in ${row.name}`} title="More section actions"><MoreHorizontal size={18}/></summary><div><button className="text-button danger-text" disabled={busy} onClick={event => { event.currentTarget.closest('details')?.removeAttribute('open'); onDeleteSection(row, section); }}>Delete section</button></div></details>}
                  {!can('SECTION_UPDATE') && !can('SECTION_DELETE') && <span className="muted">View only</span>}
                </div></td>
              </tr>)}</tbody></table> : <p className="compact-empty">No sections yet. Add a section to configure this class.</p>}
            </div>}
          </td></tr></Fragment>;
        })}</tbody></table></div>}
    {pages > 1 && <div className="academic-pagination"><span>Page {currentPage} of {pages}</span><div className="button-row"><button className="button secondary" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>Previous</button><button className="button secondary" disabled={currentPage === pages} onClick={() => setPage(currentPage + 1)}>Next</button></div></div>}
  </section>;
}
