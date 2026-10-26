'use client';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { MoreHorizontal, Search, PanelLeft, Plus } from 'lucide-react';
import { useSchoolAcademicGroups } from '../../../../lib/school-academic-groups-context';
import { useAuth } from '../../../../lib/auth-context';
import { useAcademicYear } from '../../../../lib/academic-year-context';
import { ApiError, classWorkspaceApi, timetablePlanningApi, timetableRulesApi } from '../../../../lib/api';
import { latestSectionPlans, timetableConflicts } from '../../../../lib/timetable-overview';
import { filterTimetableClasses, mergeTimetableIssues } from '../../../../lib/timetable-presentation';
import { printTimetableCollection, downloadTimetableCSV } from '../../../../lib/timetable-export';
import { EmptyState, ErrorState, LoadingState } from '../../../../components/ui';
import { TimetablePlanner } from '../../../../components/timetable-planner';
import { TimetableNavigator } from '../../../../components/timetable-navigator';
import { TimetableDrawer } from '../../../../components/timetable-drawer';
import { TimetableResult } from '../../../../components/timetable-result';

export default function TimetablesPage() {
  const { groups: schoolGroups } = useSchoolAcademicGroups(), { session, can } = useAuth(), { selected } = useAcademicYear();
  const key = JSON.stringify([session?.token, session?.permissions, selected?.id]), context = useRef(key); context.current = key;
  const [data, setData] = useState<{ key: string; classes: any[]; plans: any[] }>({ key: '', classes: [], plans: [] });
  const [group, setGroup] = useState(''), [classId, setClassId] = useState(''), [search, setSearch] = useState(''), [sectionId, setSectionId] = useState('');
  const [operation, setOperation] = useState(''), [sectionBusy, setSectionBusy] = useState(false), [loading, setLoading] = useState(true), [error, setError] = useState(''), [retry, setRetry] = useState(0);
  const [checks, setChecks] = useState<Record<string, any>>({}), [result, setResult] = useState<any>(), [navigatorOpen, setNavigatorOpen] = useState(false), [batchOpen, setBatchOpen] = useState(false), [batchClasses, setBatchClasses] = useState<string[]>([]);
  const menu = useRef<HTMLDetailsElement>(null);
  const classes = data.key === key ? data.classes : [], plans = data.key === key ? data.plans : [];
  const pending = loading || Boolean(session && selected && data.key !== key && !error), locked = Boolean(operation) || sectionBusy || pending;
  const latest = useMemo(() => latestSectionPlans(plans), [plans]), conflicts = useMemo(() => timetableConflicts(plans, classes), [plans, classes]);
  const groupClasses = filterTimetableClasses(classes, group, '', ''), visible = filterTimetableClasses(classes, group, classId, search);
  const sections = visible.flatMap(c => c.sections.map((s: any) => ({ class: c, section: s })));
  const current = sections.find(item => item.section.id === sectionId) || sections[0];
  const selectedPlans = useMemo(() => plans.filter(plan => plan.sectionId === current?.section.id), [plans, current?.section.id]);
  const filteredPlans = sections.map(item => ({ label: `${item.class.name} / Section ${item.section.name}`, plan: latest.get(item.section.id) })).filter(item => item.plan);
  const drafts = filteredPlans.filter(item => item.plan.status === 'DRAFT');
  const currentPlan = current && latest.get(current.section.id), issues = currentPlan ? mergeTimetableIssues(conflicts[currentPlan.id] || [], checks[currentPlan.id]?.errors || []) : [];
  useEffect(() => {
    let active = true; setGroup(''); setClassId(''); setSearch(''); setSectionId(''); setChecks({}); setResult(undefined); setError(''); setOperation(''); setSectionBusy(false); setBatchOpen(false);
    if (!session || !selected) { setLoading(false); return; }
    setLoading(true);
    Promise.all([classWorkspaceApi.list(session.token, selected.id), timetablePlanningApi.allPlans(session.token, selected.id)]).then(([rows, plans]) => {
      if (active) setData({ key, classes: rows.filter(c => c.status !== 'INACTIVE').map(c => ({ ...c, sections: c.sections.filter(s => s.status !== 'INACTIVE') })), plans });
    }).catch(error => { if (active) { setError(error.message); setData({ key, classes: [], plans: [] }); } }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [key, retry]);
  const refreshPlans = async () => {
    if (!session || !selected) return;
    const plans = await timetablePlanningApi.allPlans(session.token, selected.id);
    if (context.current === key) { setData(previous => ({ ...previous, key, plans })); setChecks({}); }
  };
  const run = async (name: string, action: () => Promise<void>) => {
    if (locked || !session || !selected) return;
    setOperation(name); setError(''); setResult(undefined); menu.current?.removeAttribute('open');
    try { await action(); } catch (error) { if (context.current === key) setResult(error instanceof ApiError ? { message: error.message, ...(error.details as object || {}) } : { message: error instanceof Error ? error.message : 'Timetable action failed.' }); }
    finally { if (context.current === key) setOperation(''); }
  };
  const generate = (classIds?: string[]) => run('Generating', async () => {
    const target = classIds ? visible.filter(c => classIds.includes(c.id)) : visible;
    const sectionIds = target.flatMap(c => c.sections.map((s: any) => s.id)); if (!sectionIds.length) return;
    const generated = await timetableRulesApi.generate(session!.token, { academicYearId: selected!.id, groupId: group || undefined, sectionIds, date: new Date().toISOString() });
    await refreshPlans(); if (context.current === key) { setResult(generated); setBatchOpen(false); }
  });
  const validateAll = () => run('Validating', async () => {
    const checked = await Promise.all(filteredPlans.filter(item => ['DRAFT', 'PUBLISHED'].includes(item.plan.status)).map(async item => [item.plan.id, await timetableRulesApi.validate(session!.token, item.plan.id)] as const));
    if (context.current === key) { setChecks(Object.fromEntries(checked)); setResult({ success: true, message: `Checked ${checked.length} timetable(s). ${checked.filter(([, check]) => !check.valid).length} require review. Select a section to inspect issues.` }); }
  });
  const publishAll = () => run('Publishing', async () => {
    const published = await timetablePlanningApi.publishAll(session!.token, { academicYearId: selected!.id, planIds: drafts.map(item => item.plan.id) });
    await refreshPlans(); if (context.current === key) setResult({ success: true, message: `${published.publishedPlans} timetable(s) published. Every selected draft passed atomic validation.` });
  });
  const deleteAll = () => {
    if (locked || !selected || !window.confirm(`Delete ALL timetables for ${selected.name}? This permanently removes every draft, published timetable, older version, entry and linked substitution across ALL academic groups, regardless of the current filters. Period templates and teacher setup are preserved.`)) return;
    void run('Deleting', async () => { await timetablePlanningApi.removeAll(session!.token, selected.id); await refreshPlans(); if (context.current === key) setResult({ success: true, message: 'All timetables for this academic year were deleted.' }); });
  };
  const exportAll = (format: 'PDF' | 'CSV') => {
    menu.current?.removeAttribute('open');
    if (format === 'CSV') downloadTimetableCSV(filteredPlans, 'DAVI-filtered-timetables.csv');
    else printTimetableCollection(filteredPlans, session?.user.school?.name || 'School', selected?.name || '');
  };
  if (!can('TIMETABLE_VIEW')) return <EmptyState title="Timetable access required" detail="Your role does not grant access to this workspace."/>;
  return <div className="tt-workspace-page">
    <header className="tt-page-toolbar"><div className="tt-page-title"><h1>Timetables</h1><span>{selected?.name || 'Select an academic year'}</span></div>
      <label className="tt-filter"><span className="tt-sr-only">Academic group</span><select aria-label="Academic group" disabled={locked} value={group} onChange={e => { setGroup(e.target.value); setClassId(''); setResult(undefined); }}><option value="">Whole school</option>{schoolGroups.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
      <label className="tt-filter"><span className="tt-sr-only">Class filter</span><select aria-label="Class filter" disabled={locked} value={classId} onChange={e => { setClassId(e.target.value); setResult(undefined); }}><option value="">All classes</option>{groupClasses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
      <label className="tt-search"><Search size={14} aria-hidden="true"/><input type="search" aria-label="Search classes and sections" placeholder="Search class or section" disabled={locked} value={search} onChange={e => setSearch(e.target.value)}/></label>
      {can('TIMETABLE_GENERATE') && <button className="button tt-generate-filtered" disabled={locked || !sections.length} onClick={() => void generate()}><Plus size={14}/>{operation === 'Generating' ? 'Generating…' : `Generate (${sections.length})`}</button>}
      <details className="tt-actions-menu tt-page-more" ref={menu}><summary aria-label="More timetable actions"><MoreHorizontal size={19}/><span>More</span></summary><div>
        {can('TIMETABLE_GENERATE') && <button disabled={locked || !sections.length} onClick={() => { menu.current?.removeAttribute('open'); setBatchClasses(visible.filter(c => c.sections.length).map(c => c.id)); setBatchOpen(true); }}>Choose classes for batch generation</button>}
        <button disabled={locked || !filteredPlans.length} onClick={() => void validateAll()}>Validate all filtered ({filteredPlans.length})</button>
        {can('TIMETABLE_PUBLISH') && <button disabled={locked || !drafts.length} onClick={() => void publishAll()}>Publish all filtered drafts ({drafts.length})</button>}
        <button disabled={locked || !filteredPlans.length} onClick={() => exportAll('PDF')}>Print / Save filtered as PDF</button><button disabled={locked || !filteredPlans.length} onClick={() => exportAll('CSV')}>Download filtered CSV</button>
        <Link href="/academics/groups">Group setup &amp; readiness</Link><Link href="/academics/timetable-settings">Subjects &amp; teachers</Link><Link href="/academics/period-templates">Period templates</Link>
        {can('TIMETABLE_UPDATE') && <button className="danger-text" disabled={locked || !plans.length} onClick={deleteAll}>Delete ALL timetables in year…</button>}
      </div></details>
    </header>
    <p className="tt-scope-summary">{visible.length} classes · {sections.length} sections in scope. Generate, validate, publish and export follow these filters. Publishing is atomic; failed generation keeps existing timetables.</p>
    {operation && <p className="tt-operation" role="status">{operation} timetables…</p>}
    <TimetableResult result={result} sectionLabels={Object.fromEntries(classes.flatMap(c => c.sections.map((s: any) => [s.id, `${c.name} / Section ${s.name}`])))}/>
    {error && <ErrorState message={error} retry={() => setRetry(value => value + 1)}/ >}
    {!selected ? <EmptyState title="Select an academic year"/> : pending ? <LoadingState label="Loading timetable workspace…"/> : !classes.length ? !error && <EmptyState title="Create classes first"/> : !sections.length ? <div className="tt-empty"><strong>No sections match these filters</strong><p>Try another class, academic group or search.</p><button className="button secondary" onClick={() => { setSearch(''); setGroup(''); setClassId(''); }}>Reset filters</button></div> : <>
      <div className="tt-mobile-selection"><label>Select class / section<select aria-label="Select class and section" value={current?.section.id || ''} disabled={locked} onChange={e => setSectionId(e.target.value)}>{visible.map(c => <optgroup key={c.id} label={c.name}>{c.sections.map((s: any) => <option key={s.id} value={s.id}>Section {s.name} · {latest.get(s.id)?.status || 'Missing'}</option>)}</optgroup>)}</select></label></div>
      <div className={`tt-master-detail${navigatorOpen ? ' tt-nav-open' : ''}`}><aside className="tt-master-panel"><button className="tt-navigator-toggle" aria-expanded={navigatorOpen} aria-controls="tt-section-navigator" onClick={() => setNavigatorOpen(!navigatorOpen)}><PanelLeft size={15}/>Sections ({sections.length})</button><div className="tt-navigator-content" id="tt-section-navigator"><div className="tt-nav-title">Classes &amp; sections <span>{sections.length}</span></div><TimetableNavigator classes={visible} latest={latest} conflicts={conflicts} checks={checks} selectedId={current?.section.id || ''} disabled={locked} onSelect={id => { setSectionId(id); setNavigatorOpen(false); }}/></div></aside>
        <div className="tt-detail-panel" aria-label="Selected section timetable">{current && <TimetablePlanner key={key + current.section.id} yearId={selected.id} yearLabel={selected.name} classId={current.class.id} sectionId={current.section.id} sectionLabel={`${current.class.name} / Section ${current.section.name}`} subjects={[]} providedPlans={selectedPlans} onChanged={refreshPlans} conflictEntries={issues} externalBusy={Boolean(operation)} onBusyChange={busy=>{if(context.current===key)setSectionBusy(busy);}} onValidated={(id, validation) => setChecks(previous => ({ ...previous, [id]: validation }))}/>}</div>
      </div>
    </>}
    {batchOpen && <TimetableDrawer title="Generate selected classes" locked={locked} onClose={() => setBatchOpen(false)}><p className="tt-history-help">Choose classes from the current filters. All matching sections are generated together with their assigned templates. Existing published schedules and versions remain until explicitly changed.</p><fieldset className="tt-batch-classes" disabled={locked}><legend>Classes in the filtered scope</legend>{visible.filter(c => c.sections.length).map(c => <label key={c.id}><input type="checkbox" checked={batchClasses.includes(c.id)} onChange={e => setBatchClasses(previous => e.target.checked ? [...previous, c.id] : previous.filter(id => id !== c.id))}/><span>{c.name}<small>{c.sections.length} sections</small></span></label>)}</fieldset><button className="button" disabled={locked || !batchClasses.length} onClick={() => void generate(batchClasses)}>{operation || 'Generate selected classes'}</button>{result && <TimetableResult result={result}/ >}</TimetableDrawer>}
  </div>;
}
