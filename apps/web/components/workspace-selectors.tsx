'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAcademicYear } from '../lib/academic-year-context';
import { useAuth } from '../lib/auth-context';
import { classWorkspaceApi } from '../lib/api';
import type { ClassWorkspace } from '../lib/types';
import { ErrorState, Field } from './ui';
export function WorkspaceSelectors({ rows, classId = '', sectionId = '', yearId }: { rows?: ClassWorkspace[]; classId?: string; sectionId?: string; yearId?: string }) {
  const { session } = useAuth();
  const { years, selectedId, setSelectedId, loading } = useAcademicYear();
  const router = useRouter();
  const year = yearId || selectedId;
  const [options, setOptions] = useState<ClassWorkspace[]>([]);
  const [chosenClass, setChosenClass] = useState(classId);
  const [chosenSection, setChosenSection] = useState(sectionId);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const key = `davi:workspace:${session?.user.school?.id}:${session?.user.id}:${year}`;
  useEffect(() => {
    setChosenClass(classId); setChosenSection(sectionId);
    if (classId) { try { localStorage.setItem(key, JSON.stringify({ classId, sectionId })); } catch {} }
    else { try { const saved = JSON.parse(localStorage.getItem(key) || '{}'); setChosenClass(saved.classId || ''); setChosenSection(saved.sectionId || ''); } catch {} }
  }, [classId, sectionId, key]);
  useEffect(() => {
    if (rows || !session || !year) return;
    let active = true; setBusy(true); setError(''); setOptions([]);
    classWorkspaceApi.list(session.token, year).then(result => { if (active) setOptions(result); }).catch(() => { if (active) setError('Class selections could not be loaded. Return to Class Workspace to try again.'); }).finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, [rows, session?.token, year]);
  const classes = rows || options;
  const currentClass = classes.find(item => item.id === chosenClass);
  const currentSection = currentClass?.sections.find(item => item.id === chosenSection);
  function open(c: string, s: string) {
    setChosenClass(c); setChosenSection(s);
    if (c && s) router.push(`/academics/workspace/${c}/sections/${s}?year=${encodeURIComponent(year)}`);
  }
  return <><section className="card workspace-selectors" aria-label="Workspace selection">
    <Field label="Academic year"><select disabled={loading || !years.length} value={year} onChange={e => { setSelectedId(e.target.value); if (classId) router.push('/academics/workspace'); }}>{!years.length && <option value="">No academic year</option>}{years.map(item => <option key={item.id} value={item.id}>{item.name}{item.isCurrent ? ' · Current' : ''}</option>)}</select></Field>
    <Field label="Class"><select disabled={busy || !classes.length} value={currentClass?.id || ''} onChange={e => { const item = classes.find(item => item.id === e.target.value); open(e.target.value, item?.sections.length === 1 ? item.sections[0].id : ''); }}><option value="">{busy ? 'Loading classes…' : 'Select class'}</option>{classes.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field>
    <Field label="Section"><select disabled={!currentClass?.sections.length} value={currentSection?.id || ''} onChange={e => open(chosenClass, e.target.value)}><option value="">Select section</option>{currentClass?.sections.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field>
    {!classId && currentSection && <button className="button" onClick={() => open(chosenClass, chosenSection)}>Continue workspace</button>}
  </section>{error && <ErrorState message={error}/>}</>;
}
