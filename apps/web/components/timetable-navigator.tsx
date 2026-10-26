'use client';
import { useEffect, useId, useState } from 'react';
import { ChevronDown, AlertCircle } from 'lucide-react';
import { mergeTimetableIssues } from '../lib/timetable-presentation';
export function TimetableNavigator({ classes, latest, conflicts, checks, selectedId, onSelect, disabled }: { classes: any[]; latest: Map<string, any>; conflicts: Record<string, any[]>; checks: Record<string, any>; selectedId: string; onSelect: (id: string) => void; disabled: boolean }) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set()), id = useId();
  useEffect(()=>{setCollapsed(previous=>{const next=new Set(previous);const selected=classes.find(c=>c.sections.some((s:any)=>s.id===selectedId));if(selected)next.delete(selected.id);return next;});},[selectedId]);
  return <nav className="tt-section-nav" aria-label="Timetable sections">{classes.map(c => {
    const expanded = !collapsed.has(c.id);
    const controls = `${id}-${c.id}`;
    return <section key={c.id}><button className="tt-nav-class" aria-expanded={expanded} aria-controls={controls} onClick={() => setCollapsed(previous => { const next = new Set(previous); if (expanded) next.add(c.id); else next.delete(c.id); return next; })}><ChevronDown size={13} className={expanded ? '' : 'tt-chevron-closed'}/><strong>{c.name}</strong><span>{c.sections.length}</span></button><div id={controls} hidden={!expanded}>{!c.sections.length && <p className="tt-nav-empty">No active sections</p>}{c.sections.map((s: any) => {
      const plan = latest.get(s.id), issues = plan ? mergeTimetableIssues(conflicts[plan.id] || [], checks[plan.id]?.errors || []) : [];
      return <button key={s.id} className={`tt-nav-section ${selectedId === s.id ? 'is-selected' : ''}`} aria-current={selectedId === s.id ? 'page' : undefined} disabled={disabled} onClick={() => onSelect(s.id)}><span>Section {s.name}</span><span className="tt-nav-indicators">{issues.length > 0 && <span className="tt-nav-conflict" title={`${issues.length} detected issues`}><AlertCircle size={12}/><span className="tt-sr-only">{issues.length} detected issues</span></span>}<span className={`tt-status tt-status-${String(plan?.status || 'missing').toLowerCase()}`}>{plan?.status === 'PUBLISHED' ? 'Published' : plan?.status === 'DRAFT' ? 'Draft' : plan?.status ? String(plan.status).toLowerCase() : 'Missing'}</span></span></button>;
    })}</div></section>;
  })}</nav>;
}
