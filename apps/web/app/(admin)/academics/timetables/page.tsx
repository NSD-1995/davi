'use client';
import {useSchoolAcademicGroups} from '../../../../lib/school-academic-groups-context';
import {printTimetables} from '../../../../lib/print-timetables';
import {academicGroup} from '../../../../lib/academic-groups';
import {latestSectionPlans,timetableConflicts} from '../../../../lib/timetable-overview';
import Link from 'next/link';
import {useEffect,useMemo,useState} from 'react';
import {ApiError,classWorkspaceApi,timetablePlanningApi,timetableRulesApi} from '../../../../lib/api';
import {useAuth} from '../../../../lib/auth-context';
import {useAcademicYear} from '../../../../lib/academic-year-context';
import {EmptyState,ErrorState,Field,LoadingState,PageHeader} from '../../../../components/ui';
import {TimetablePlanner} from '../../../../components/timetable-planner';
import {TimetableResult} from '../../../../components/timetable-result';

export default function TimetablesPage(){
 const {groups:schoolGroups}=useSchoolAcademicGroups();
 const {session,can}=useAuth(),{selected}=useAcademicYear();
 const [group,setGroup]=useState(''),[classes,setClasses]=useState<any[]>([]),[plans,setPlans]=useState<any[]>([]);
 const [classId,setClassId]=useState('');
 const [publishing,setPublishing]=useState(false);
 const [deleting,setDeleting]=useState(false);
 const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[checking,setChecking]=useState(false);
 const [result,setResult]=useState<any>(),[error,setError]=useState(''),[revision,setRevision]=useState(0),[checks,setChecks]=useState<Record<string,any>>({});
 const latest=useMemo(()=>latestSectionPlans(plans),[plans]);
 const conflicts=useMemo(()=>timetableConflicts(plans,classes),[plans,classes]);
 const groupClasses=classes.filter(c=>!group||academicGroup(c)===group);
 const visible=groupClasses.filter(c=>!classId||c.id===classId);
 const publishable=visible.flatMap(c=>c.sections.map((s:any)=>latest.get(s.id))).filter(p=>p?.status==='DRAFT');
 const selectedClass=visible.find(c=>c.id===classId);
 const refreshPlans=async()=>{if(!session||!selected)return;setPlans(await timetablePlanningApi.allPlans(session.token,selected.id));setChecks({});};
 useEffect(()=>{let active=true;setClasses([]);setPlans([]);setGroup('');setClassId('');setChecks({});setResult(undefined);setError('');
  if(!session||!selected){setLoading(false);return;}setLoading(true);
  Promise.all([classWorkspaceApi.list(session.token,selected.id),timetablePlanningApi.allPlans(session.token,selected.id)]).then(([rows,p])=>{if(!active)return;
   const c=rows.filter(r=>r.status!=='INACTIVE').map(r=>({...r,sections:r.sections.filter(s=>s.status!=='INACTIVE')}));setClasses(c);setPlans(p);
  }).catch(e=>{if(active)setError(e.message);}).finally(()=>{if(active)setLoading(false);});return()=>{active=false;};
 },[session?.token,selected?.id]);
 const generate=async()=>{if(!session||!selected||!visible.some(c=>c.sections.length))return;setBusy(true);setResult(undefined);try{
  const generated=await timetableRulesApi.generate(session.token,{academicYearId:selected.id,groupId:group||undefined,classId:classId||undefined,sectionIds:visible.flatMap(c=>c.sections.map((s:any)=>s.id)),date:new Date().toISOString()});setResult(generated);await refreshPlans();setRevision(v=>v+1);
 }catch(e){setResult(e instanceof ApiError?{message:e.message,...(e.details as object||{})}:{message:e instanceof Error?e.message:'Generation failed.'});}finally{setBusy(false);}};
 const publishAll=async()=>{if(!session||!selected||!publishable.length)return;setPublishing(true);setError('');setResult(undefined);try{const response=await timetablePlanningApi.publishAll(session.token,{academicYearId:selected.id,planIds:publishable.map(p=>p.id)});await refreshPlans();setRevision(v=>v+1);setResult({success:true,message:response.publishedPlans+' timetable(s) published successfully.'});}catch(e){setResult(e instanceof ApiError?{message:e.message,...(e.details as object||{})}:{message:e instanceof Error?e.message:'Could not publish timetables.'});}finally{setPublishing(false);}};
 const deleteAll=async()=>{if(!session||!selected||!window.confirm(`Delete all timetables for ${selected.name}? This permanently removes every draft, published timetable, older version, entry and linked substitution across all academic groups. Period templates and subject/teacher setup are preserved.`))return;setDeleting(true);setError('');setResult(undefined);try{await timetablePlanningApi.removeAll(session.token,selected.id);await refreshPlans();setRevision(v=>v+1);}catch(e){setError(e instanceof Error?e.message:'Could not delete timetables.');}finally{setDeleting(false);}};
 const checkAll=async()=>{if(!session)return;setChecking(true);setError('');try{const results=await Promise.all([...latest.values()].filter(p=>['DRAFT','PUBLISHED'].includes(p.status)).map(async p=>[p.id,await timetableRulesApi.validate(session.token,p.id)]));setChecks(Object.fromEntries(results));}catch(e){setError(e instanceof Error?e.message:'Could not check timetables.');}finally{setChecking(false);}};
 return <div className="timetable-page"><div className="print-only"><h1>{session?.user.school?.name||'School'} - Timetables</h1><p>{selected?.name}</p></div><div className="no-print"><PageHeader title="Timetables" description={selected?selected.name+' - All class and section timetables.':'Select an academic year.'}/>
 <section className="card"><Field label="Academic group"><select disabled={busy||loading||deleting||publishing} value={group} onChange={e=>{const g=e.target.value;setGroup(g);setClassId('');setResult(undefined);}}><option value="">Whole school</option>{schoolGroups.map(g=><option key={g.id} value={g.id}>{g.label}</option>)}</select></Field><Field label="Class"><select disabled={busy||loading||deleting||publishing} value={classId} onChange={e=>{setClassId(e.target.value);setResult(undefined);}}><option value="">All classes</option>{groupClasses.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></Field><div className="button-row"><Link className="button secondary" href="/academics/groups">Group setup &amp; readiness</Link><Link className="button secondary" href="/academics/timetable-settings">Subjects &amp; teachers</Link><Link className="button secondary" href="/academics/period-templates">Period templates</Link>{can('TIMETABLE_GENERATE')&&<button className="button" disabled={busy||loading||deleting||checking||publishing||!visible.some(c=>c.sections.length)} onClick={()=>void generate()}>{busy?'Generating...':selectedClass?'Generate '+selectedClass.name:group?'Generate '+schoolGroups.find(g=>g.id===group)?.label:'Generate all classes'}</button>}</div><p>Generate the selected class and all its sections using their active assigned period templates. Working days, teaching times and breaks follow each template. Choose All classes to generate the academic group together. A failed batch keeps the existing timetables.</p></section>
 <TimetableResult result={result} sectionLabels={Object.fromEntries(classes.flatMap(c=>c.sections.map((s:any)=>[s.id,c.name+' / Section '+s.name])))}/>
 </div>
 {error&&<ErrorState message={error}/>} {loading?<LoadingState/>:!selected?<EmptyState title="Select an academic year"/>:!classes.length?<EmptyState title="Create classes first"/>:<>
 <section className="card no-print"><div className="card-heading"><div><h2>All timetables</h2><p>The latest timetable for every class and section is shown below. Older versions are available within each section.</p></div><div className="button-row"><button className="button secondary" disabled={loading||busy||deleting||!visible.some(c=>c.sections.some((s:any)=>latest.has(s.id)))} onClick={()=>printTimetables()}>Print / Save as PDF</button><button className="button secondary" disabled={checking||busy||deleting||publishing||!latest.size} onClick={()=>void checkAll()}>{checking?'Checking...':'Check all timetables'}</button>{can('TIMETABLE_PUBLISH')&&<button className="button" disabled={loading||busy||checking||deleting||publishing||!publishable.length} onClick={()=>void publishAll()}>{publishing?'Publishing...':'Publish all ('+publishable.length+')'}</button>}{can('TIMETABLE_UPDATE')&&<button className="button secondary danger-text" disabled={loading||busy||checking||deleting||publishing||!plans.length} onClick={()=>void deleteAll()}>{deleting?'Deleting...':'Delete all timetables'}</button>}</div></div><p>Publish all publishes the latest drafts matching the academic group and class filters. Every draft is validated; if any fails, none are published. In the print dialog, choose Save as PDF to download all visible timetables.</p></section>
 {visible.map(c=><section key={c.id} aria-label={c.name+' timetables'}><h2 className="no-print">{c.name}</h2>{!c.sections.length?<EmptyState title="No sections in this class"/>:c.sections.map((s:any)=>{
  const p=latest.get(s.id),issues=p?[...(conflicts[p.id]||[]),...(checks[p.id]?.errors||[])]:[];
  return <article className="timetable-sheet" key={s.id} id={'timetable-'+s.id}><div className="card-heading"><h3>{c.name} / Section {s.name}</h3>{p&&<span className={issues.length?'danger-text':'muted'}>{issues.length?issues.length+' issue(s)':checks[p.id]?.valid?'Validation passed':'No overlaps detected'}</span>}</div>
   {issues.length>0&&<div className="no-print"><TimetableResult result={{valid:false,errors:issues}}/></div>}
   <TimetablePlanner key={s.id+':'+revision} yearId={selected.id} classId={c.id} sectionId={s.id} subjects={[]} onChanged={refreshPlans} conflictEntries={issues} providedPlans={plans.filter(plan=>plan.sectionId===s.id)}/>
  </article>;
 })}</section>)}
 </> }</div>;
}
