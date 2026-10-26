'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Maximize2, Minimize2, History, MoreHorizontal, Printer, Download } from 'lucide-react';
import { ApiError, timetablePlanningApi, timetableRulesApi, operationsApi } from '../lib/api';
import { useAuth } from '../lib/auth-context';
import { useToast } from '../lib/toast-context';
import { latestSectionPlans } from '../lib/timetable-overview';
import { mergeTimetableIssues } from '../lib/timetable-presentation';
import { downloadTimetableCSV, printTimetableCollection } from '../lib/timetable-export';
import { EmptyState, ErrorState, LoadingState } from './ui';
import { TimetableResult } from './timetable-result';
import { TimetableMatrix } from './timetable-matrix';
import { TimetableDrawer } from './timetable-drawer';

const errorResult = (error: unknown) => error instanceof ApiError ? { message: error.message, ...(error.details as object || {}) } : { message: error instanceof Error ? error.message : 'Timetable action failed.' };
export function TimetablePlanner({ yearId, classId, sectionId, sectionLabel = 'Section timetable', yearLabel = '', onChanged, conflictEntries = [], providedPlans, externalBusy = false, onBusyChange, onValidated }: {
  yearId: string; classId: string; sectionId: string; subjects: any[]; sectionLabel?: string; yearLabel?: string;
  onChanged?: () => Promise<void>; conflictEntries?: any[]; providedPlans?: any[]; externalBusy?: boolean; onBusyChange?: (busy: boolean) => void; onValidated?: (planId: string, result: any) => void;
}) {
  const { session, can } = useAuth(), { show } = useToast();
  const [loadedPlans, setPlans] = useState<any[]>([]), [loading, setLoading] = useState(!providedPlans), [busy, setBusy] = useState(false), [result, setResult] = useState<any>();
  const [tab, setTab] = useState<'weekly' | 'daily'>('weekly'), [daily, setDaily] = useState<any>(), [dailyLoading, setDailyLoading] = useState(false), [coverDate, setCoverDate] = useState(''), [dailyError, setDailyError] = useState('');
  const [historyOpen, setHistoryOpen] = useState(false), [previewId, setPreviewId] = useState(''), [fullScreen, setFullScreen] = useState(false), [validation, setValidation] = useState<Record<string, any>>({});
  const panel = useRef<HTMLElement>(null), actions = useRef<HTMLDetailsElement>(null), alive = useRef(true), generation = useRef(0);
  const contextKey=JSON.stringify([session?.token,yearId,classId,sectionId]),currentContext=useRef(contextKey);currentContext.current=contextKey;
  const isCurrent=()=>alive.current&&currentContext.current===contextKey;
  const [loadedKey,setLoadedKey]=useState('');
  const plans = providedPlans ?? (loadedKey===contextKey?loadedPlans:[]);
  const ordered = useMemo(() => [...plans].sort((a, b) => +new Date(b.generatedAt || 0) - +new Date(a.generatedAt || 0) || b.version - a.version), [plans]);
  const latest = latestSectionPlans(plans).get(sectionId), published = ordered.find(p => p.status === 'PUBLISHED');
  const weeklyPlan = ordered.find(p => p.id === previewId) || latest;
  const plan = tab === 'daily' ? published : weeklyPlan;
  const locked = busy || externalBusy;
  const ownIssues = plan ? mergeTimetableIssues(plan.id === latest?.id ? conflictEntries : [], validation[plan.id]?.errors || []) : [];
  useEffect(() => { alive.current = true; return () => { alive.current = false; generation.current++; }; }, []);
  const load = async () => {
    if (!session || providedPlans || !isCurrent()) return;
    const id = ++generation.current; setLoading(true);
    try { const rows = await timetablePlanningApi.plans(session.token, yearId, classId, sectionId); if (isCurrent() && id === generation.current) {setPlans(rows);setLoadedKey(contextKey);} }
    catch (error) { if (isCurrent() && id === generation.current) {setResult(errorResult(error));setLoadedKey(contextKey);} }
    finally { if (isCurrent() && id === generation.current) setLoading(false); }
  };
  useEffect(() => { setBusy(false);setFullScreen(false);setResult(undefined); setPreviewId(''); setValidation({}); setCoverDate(''); setTab('weekly'); if (!providedPlans) { setPlans([]); void load(); } }, [session?.token, yearId, classId, sectionId]);
  useEffect(() => { setValidation({}); }, [providedPlans]);
  useEffect(() => {
    if (!fullScreen) return;
    const previous = document.activeElement as HTMLElement | null, overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden'; panel.current?.focus();
    const key = (event: KeyboardEvent) => { if(document.querySelector('dialog[open]'))return; if(event.key==='Escape')setFullScreen(false);if(event.key==='Tab'){const items=Array.from(panel.current?.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],input:not(:disabled),summary,[tabindex="0"]')||[]).filter(item=>item.getClientRects().length);const first=items[0],last=items[items.length-1];if(event.shiftKey&&(document.activeElement===first||document.activeElement===panel.current)){event.preventDefault();last?.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}} };
    document.addEventListener('keydown', key);
    return () => { document.body.style.overflow = overflow; document.removeEventListener('keydown', key); previous?.focus(); };
  }, [fullScreen]);
  const run = async (action: () => Promise<void>) => {
    if (locked || !session) return; setBusy(true); onBusyChange?.(true); setResult(undefined);
    try { await action(); } catch (error) { if (isCurrent()) setResult(errorResult(error)); }
    finally { if (isCurrent()) setBusy(false); onBusyChange?.(false); }
  };
  const refresh = async () => { if(!isCurrent())return;await load();if(isCurrent())await onChanged?.(); };
  const generate = () => run(async () => { const generated = await timetablePlanningApi.generate(session!.token, { academicYearId: yearId, classId, sectionId, date: new Date().toISOString() }); await refresh(); if (isCurrent()) { setPreviewId(''); setValidation({}); setResult(generated); } });
  const validate = () => plan && run(async () => { const checked = await timetableRulesApi.validate(session!.token, plan.id); if (isCurrent()) { setValidation(previous => ({ ...previous, [plan.id]: checked })); setResult(checked); onValidated?.(plan.id, checked); } });
  const publish = () => plan && run(async () => { await timetablePlanningApi.publish(session!.token, plan.id); await refresh(); if (isCurrent()) { setResult({ success: true, message: `Version ${plan.version} published.` }); show('Timetable published.'); } });
  const remove = () => {
    if (!plan || !window.confirm(`Delete timetable version ${plan.version} (${plan.status}) for ${sectionLabel}? This permanently removes its entries and linked substitutions. Other versions are retained.`)) return;
    void run(async () => { await timetablePlanningApi.remove(session!.token, plan.id); await refresh(); if (isCurrent()) { setPreviewId(''); show('Timetable version deleted.'); } });
  };
  const print = () => { if (plan) { actions.current?.removeAttribute('open'); printTimetableCollection([{ label: sectionLabel, plan }], session?.user.school?.name || 'School', yearLabel); } };
  const openDaily = async () => {
    setTab('daily'); setResult(undefined); if (coverDate || !session) return;
    setDailyLoading(true); setDailyError('');
    try { const clock = await operationsApi.get(session.token, 'clock'); if (isCurrent()) setCoverDate(clock.date); }
    catch (error) { if (isCurrent()) { setDailyError(error instanceof Error ? error.message : 'School date unavailable.'); setDailyLoading(false); } }
  };
  useEffect(() => {
    setDaily(undefined); setDailyError('');
    if (tab !== 'daily' || !session || !coverDate || !published) { setDailyLoading(false); return; }
    let active = true; setDailyLoading(true);
    const own = can('timetable.substitution.view') || (can('ATTENDANCE_VIEW') && can('STAFF_VIEW')) ? '' : '&own=true';
    operationsApi.get(session.token, 'effective-timetable?' + new URLSearchParams({ date: coverDate, classId, sectionId, academicYearId: yearId }) + own).then(data => { if (active) setDaily(data); }).catch(error => { if (active) setDailyError(error.message); }).finally(() => { if (active) setDailyLoading(false); });
    return () => { active = false; };
  }, [session?.token, tab, coverDate, classId, sectionId, yearId, published?.id]);
  if ((loading || loadedKey!==contextKey) && !providedPlans) return <LoadingState label="Loading section timetable…"/>;
  return <section className={`tt-planner${fullScreen ? ' tt-fullscreen' : ''}`} ref={panel} tabIndex={-1} role={fullScreen?'dialog':undefined} aria-modal={fullScreen?true:undefined} aria-label={sectionLabel}>
    <header className="tt-detail-heading"><div><h2>{sectionLabel}</h2><div className="tt-plan-meta"><span className={`tt-status tt-status-${String(plan?.status || 'missing').toLowerCase()}`}>{plan?.status || 'Missing'}</span>{plan && <><span>Version {plan.version}</span><span>{plan.updatedAt ? 'Updated' : 'Generated'} {new Date(plan.updatedAt || plan.generatedAt).toLocaleString('en-IN', { timeZone: 'Asia/Calcutta' })}</span></>}{tab === 'weekly' && previewId && weeklyPlan?.id !== latest?.id && <span className="tt-history-note">Viewing older version</span>}</div></div><button className="icon-button" aria-label={fullScreen ? 'Exit full screen' : 'Full screen timetable'} aria-pressed={fullScreen} onClick={() => setFullScreen(!fullScreen)}>{fullScreen ? <Minimize2 size={17}/> : <Maximize2 size={17}/>}</button></header>
    <div className="tt-detail-toolbar"><nav className="tt-segments" aria-label="Timetable view"><button aria-current={tab === 'weekly' ? 'page' : undefined} disabled={locked} onClick={() => { setTab('weekly'); setResult(undefined); }}>Weekly Timetable</button><button aria-current={tab === 'daily' ? 'page' : undefined} disabled={locked} onClick={() => void openDaily()}>Daily Cover</button></nav><div className="tt-context-actions">
      {can('TIMETABLE_GENERATE') && <button className="button secondary" disabled={locked} onClick={() => void generate()}>{busy ? 'Working…' : latest ? 'Regenerate' : 'Generate'}</button>}
      {plan && tab === 'weekly' && <><button className="button secondary" disabled={locked} onClick={() => void validate()}>Validate</button>{plan.status === 'DRAFT' && can('TIMETABLE_PUBLISH') && <button className="button" disabled={locked || ownIssues.length > 0 || plan.entries.some((entry: any) => entry.conflictCode)} onClick={() => void publish()}>Publish</button>}<button className="tt-icon-action" disabled={locked} onClick={print}><Printer size={14}/>Print</button><button className="tt-icon-action" disabled={locked} onClick={print}><Download size={14}/>Download PDF</button></>}
      <details className="tt-actions-menu" ref={actions}><summary aria-label="More section actions"><MoreHorizontal size={18}/></summary><div><button disabled={locked || !plans.length} onClick={() => { actions.current?.removeAttribute('open'); setHistoryOpen(true); }}><History size={14}/>Version history ({plans.length})</button>{plan && <button disabled={locked} onClick={() => { actions.current?.removeAttribute('open'); downloadTimetableCSV([{ label: sectionLabel, plan }]); }}>Download selected CSV</button>}{plan && can('TIMETABLE_UPDATE') && <button className="danger-text" disabled={locked} onClick={remove}>Delete this version</button>}</div></details>
    </div></div>
    <TimetableResult result={result}/>
    {tab === 'weekly' ? <>{previewId && weeklyPlan?.id !== latest?.id && <button className="text-button" onClick={() => setPreviewId('')}>Return to latest version</button>}{ownIssues.length > 0 && <TimetableResult result={{ valid: false, errors: ownIssues }}/ >}{weeklyPlan ? <><div className="tt-validation-state">{ownIssues.length ? `${ownIssues.length} detected issues · review before publishing` : validation[weeklyPlan.id]?.valid ? 'Validation passed' : 'Not fully validated · use Validate before publishing'}</div><TimetableMatrix plan={weeklyPlan} issues={ownIssues} label={sectionLabel}/><p className="tt-template-note">Working days, timings, breaks and applicable periods follow this version’s period template. Download PDF uses the print dialog’s Save as PDF option.</p></> : <div className="tt-empty"><strong>No timetable for this section</strong><p>Generate a draft using its assigned period template and teacher allocations.</p>{can('TIMETABLE_GENERATE') ? <button className="button" disabled={locked} onClick={() => void generate()}>Generate timetable</button> : <p>Your role can view timetables; generation requires additional access.</p>}</div>}</> : <div className="tt-daily-cover"><div className="tt-daily-heading"><label>Cover date <input type="date" value={coverDate} disabled={locked} onChange={e => setCoverDate(e.target.value)}/></label><small>Uses the published timetable and recorded substitutions.</small></div>{dailyError && <ErrorState message={dailyError}/ >}{!published ? <div className="tt-empty"><strong>Publish a timetable first</strong><p>Daily Cover uses published schedules, not the latest draft.</p></div> : dailyLoading ? <LoadingState label="Loading daily cover…"/> : daily ? daily.holiday ? <EmptyState title="School holiday"/> : <>{!daily.lessons?.length && <EmptyState title="No scheduled lessons for this date"/>}<div className="tt-cover-list">{(daily.lessons || []).map((lesson: any) => <article key={lesson.key}><time>{lesson.startTime}–{lesson.endTime}</time><div><strong>{lesson.subjectName}</strong><p>{lesson.teacherName || 'Teacher not assigned'}{lesson.room ? ` · Room ${lesson.room}` : ''}</p>{lesson.substitutionId && <small>Original teacher: {lesson.originalTeacherName}. {lesson.reason}</small>}</div><span className="tt-status">{String(lesson.status).replace(/_/g, ' ').toLowerCase()}</span></article>)}</div>{daily.cancelledLessons?.map((lesson: any) => <p key={lesson.key}>{lesson.startTime} {lesson.subjectName} · Cancelled: {lesson.reason}</p>)}</> : !dailyError && <p className="muted">Choose a date to see scheduled cover.</p>}</div>}
    {historyOpen && <TimetableDrawer title={`${sectionLabel} · Version history`} onClose={() => setHistoryOpen(false)} locked={locked}><p className="tt-history-help">Preview a version in the workspace. Generating a new draft keeps existing versions and the published schedule.</p><div className="tt-history-list">{ordered.map(version => <article key={version.id}><div><strong>Version {version.version}</strong><span className={`tt-status tt-status-${String(version.status).toLowerCase()}`}>{version.status}</span><small>{new Date(version.generatedAt).toLocaleString('en-IN', { timeZone: 'Asia/Calcutta' })}</small></div><button className="button secondary" disabled={locked} onClick={() => { setPreviewId(version.id); setTab('weekly'); setResult(undefined); setHistoryOpen(false); }}>Preview{version.id === latest?.id ? ' latest' : ''}</button></article>)}</div></TimetableDrawer>}
  </section>;
}
