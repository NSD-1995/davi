'use client';
import Link, { useSearchParams } from '../lib/school-navigation';
import { useEffect, useRef, useState } from 'react';
import { RefreshCw, ChartNoAxesCombined } from 'lucide-react';
import { schoolNow } from '../lib/class-daily';
import { dashboardApi, schoolExperienceApi } from '../lib/api';
import { useAuth } from '../lib/auth-context';
import { AcademicYearSelector } from './academic-year-selector';
import { useAcademicYear } from '../lib/academic-year-context';
import { commandDayLabel, dashboardNumber, schoolDateLabel, type SchoolCommandData } from '../lib/school-command-center';
import { CommandActionCenter, CommandActivities, CommandAttendance, CommandDrawer, CommandMetric, CommandOperations, CommandState, SetupChecklist } from './school-command-center-parts';
import { CommandCenterBoard, CommandTimeline, type CommandPanel } from './command-center-board';
import { ParentQueryWorkspace, DailyActivityWorkspace } from './engagement-workspace';
import { ErrorState, LoadingState } from './ui';

export function SchoolCommandCenter() {
 const {session,can}=useAuth(),{selectedId,loading:yearLoading}=useAcademicYear(),params=useSearchParams(),queryId=params.get('queryId');
 const effectiveYearId=can('ACADEMIC_YEAR_VIEW')?selectedId:'';
 const key=JSON.stringify([session?.token,session?.user.schoolId,session?.permissions,effectiveYearId]),current=useRef(key);current.current=key;
 const [response,setResponse]=useState<{key:string;data:SchoolCommandData|null;error:string}>({key:'',data:null,error:''});
 const [busy,setBusy]=useState(false),[revision,setRevision]=useState(0),[modeChoice,setMode]=useState<'today'|'overview'|null>(null),[panel,setPanel]=useState<CommandPanel|null>(null);
 const [selectedDate,setSelectedDate]=useState('');
 const request=useRef(0);
 useEffect(()=>{if(!session||yearLoading||!can('DASHBOARD_VIEW'))return;let active=true;const id=++request.current;setBusy(true);setResponse(previous=>previous.key===key?{...previous,error:''}:{key,data:null,error:''});
 dashboardApi.command(session.token,effectiveYearId||undefined,selectedDate||undefined).then((data:SchoolCommandData)=>{if(active&&id===request.current&&current.current===key)setResponse({key,data,error:''});}).catch(error=>{if(active&&id===request.current&&current.current===key)setResponse(previous=>({key,data:previous.key===key?previous.data:null,error:error.message||'Dashboard could not be loaded.'}));}).finally(()=>{if(active&&current.current===key)setBusy(false);});return()=>{active=false;};},[key,revision,yearLoading,selectedDate]);
 useEffect(()=>{setMode(null);setPanel(null);setSelectedDate('');},[key]);
 useEffect(()=>{let timer:ReturnType<typeof setTimeout>;const update=()=>{clearTimeout(timer);timer=setTimeout(()=>setRevision(v=>v+1),120);};window.addEventListener('davi:operations-updated',update);window.addEventListener('focus',update);return()=>{clearTimeout(timer);window.removeEventListener('davi:operations-updated',update);window.removeEventListener('focus',update);};},[]);
 useEffect(()=>{const date=response.data?.clock.date,zone=response.data?.clock.timeZone;if(!date||!zone||response.key!==key)return;const timer=setInterval(()=>{if(!selectedDate&&current.current===key&&schoolNow(zone).date!==date)setRevision(value=>value+1);},60000);return()=>clearInterval(timer);},[response.data?.clock.date,response.data?.clock.timeZone,key,selectedDate]);
 useEffect(()=>{const sync=()=>{const target=hashPanels[window.location.hash];if(target)setPanel(target);};sync();window.addEventListener('hashchange',sync);return()=>window.removeEventListener('hashchange',sync);},[key,queryId]);
 if(!can('DASHBOARD_VIEW'))return <CommandState title="Dashboard access required" detail="Your current role does not grant access to the school command center."/>;
 if(yearLoading||response.key!==key||selectedDate&&response.data?.clock.date!==selectedDate&&!response.error||!response.data&&!response.error)return <LoadingState label="Loading school command center…"/>;
 if(response.error&&!response.data)return <ErrorState message={response.error} retry={()=>setRevision(value=>value+1)}/>;
 const data=response.data!;
 const schoolLogo=data.school?.logoId?schoolExperienceApi.publicMedia(data.school.logoId):data.school?.logoUrl;
 const mode=modeChoice||'today',outstanding=data.setup.steps.find(step=>step.done===false&&step.href);
 const quickLinks=[{label:'Class Workspace',href:'/academics/workspace',permission:'CLASS_VIEW'},{label:'School profile',href:'/school/profile',permission:'SCHOOL_PROFILE_VIEW'},{label:'Period templates',href:'/academics/period-templates',permission:'PERIOD_TEMPLATE_VIEW'},{label:'School calendar',href:'/academics/holidays-events',permission:'EVENT_VIEW'}].filter(link=>can(link.permission));
 const activityPanel=<CommandActivities data={data} quickLinks={quickLinks}/>;
 const availability=Object.entries(data.sources).filter(([,status])=>status!=='ready');
 const openPanel=(value:CommandPanel)=>setPanel(value);
 const closePanel=()=>{setPanel(null);if(hashPanels[window.location.hash])window.history.replaceState(null,'',window.location.pathname+window.location.search);};
 const titles:Record<CommandPanel,string>={actions:'Priority actions',attendance:'Student attendance',staff:'Staff operations and coverage',queries:'Parent queries',activities:'Classroom activities',calendar:'Events and preparation',configuration:'School configuration',status:'Data availability'};
 const sourceIssues=[...new Set([...Object.keys(data.errors),...Object.entries(data.sources).filter(([,state])=>state==='unavailable'||state==='partial').map(([source])=>source)])];
 const a=data.attendance,c=data.coverageSummary,staff=data.staff;
 const attendanceCompletion=a&&a.expected>0?Math.round(a.recorded/a.expected*100):null;
 return <div className="school-command-center cc-dashboard" data-mode={mode} onClick={event=>{const link=(event.target as Element).closest<HTMLAnchorElement>('a[href^="#"]');const target=link&&hashPanels[link.hash];if(target){event.preventDefault();openPanel(target);}}}>
  <header className="cc-control-header"><div className="cc-school-identity"><div className="cc-school-mark"><span>{data.school?.shortName?.trim()||(data.school?.name||'D').slice(0,2).toUpperCase()}</span>{schoolLogo&&<img key={schoolLogo} src={schoolLogo} alt={data.school?.name+' logo'} onError={e=>{e.currentTarget.hidden=true;}}/>}</div><div><span className="cc-eyebrow">{data.school?.name||'School'}</span><h1>Operations command center</h1><div className="cc-operational-date"><time dateTime={data.clock.date}>{schoolDateLabel(data.clock.date)}</time><span className="cc-working-day" data-state={commandDayLabel(data.dayStates).includes('not configured')?'unknown':'known'}>{commandDayLabel(data.dayStates)}</span></div></div></div><div className="cc-control-actions">{can('ACADEMIC_YEAR_VIEW')?<div title={data.academicYear?.name}><AcademicYearSelector/></div>:<span>{data.academicYear?.name}</span>}<label className="cc-control-date"><span className="cc-sr-only">Operational date</span><input aria-label="Dashboard date" type="date" value={selectedDate||data.clock.date} onChange={e=>{if(e.target.value)setSelectedDate(e.target.value);}}/></label><button className="button secondary" onClick={()=>{setSelectedDate('');setRevision(value=>value+1);}}>Today</button><button className="button secondary" aria-label="Refresh dashboard" title="Refresh dashboard" disabled={busy} onClick={()=>setRevision(value=>value+1)}><RefreshCw size={14}/><span>Refresh</span></button>{can('REPORT_VIEW')&&<Link className="button" href={'/reports/analytics?'+new URLSearchParams({view:'overview',...(data.academicYear?{academicYearId:data.academicYear.id}:{})})}><ChartNoAxesCombined size={14}/>Reports</Link>}</div></header>
  <div className="cc-dashboard-toolbar"><nav aria-label="Dashboard mode"><button aria-current={mode==='today'?'page':undefined} onClick={()=>setMode('today')}>Today</button><button aria-current={mode==='overview'?'page':undefined} onClick={()=>setMode('overview')}>Overview</button></nav><div className="cc-toolbar-links">{data.setup.outstanding>0&&<button className="text-button" onClick={()=>openPanel('configuration')}>{data.setup.outstanding} configuration pending</button>}<button className="text-button" onClick={()=>openPanel('status')}>Data status{sourceIssues.length?' ('+sourceIssues.length+')':''}</button></div></div>
  {response.error&&<div className="cc-source-notice" role="alert"><strong>Refresh failed. Showing the last successful update.</strong><span>{response.error}</span><button className="text-button" onClick={()=>setRevision(v=>v+1)}>Retry</button></div>}
  {mode==='today'?<>
   <section className="cc-metrics cc-operational-kpis" aria-label="Operational KPI strip">
    {(can('STUDENT_VIEW')||can('ATTENDANCE_VIEW'))&&data.sources.students!=='restricted'&&<CommandMetric label="Students" value={dashboardNumber(data.counts.activeStudents===undefined?data.counts.students:data.counts.activeStudents)} hint={a?(attendanceCompletion===null?'No attendance expected':attendanceCompletion+'% attendance recorded')+' / '+a.notMarked+' unmarked / '+(a.recorded?a.statuses.ABSENT:'Not yet recorded')+' absent': 'Attendance source unavailable'} href={can('ATTENDANCE_VIEW')?'#attendance-detail':can('STUDENT_VIEW')?'/people/students':undefined}/>}
    {(can('staff.attendance.view')||can('ATTENDANCE_VIEW'))&&data.sources.staffAttendance!=='restricted'&&<CommandMetric label="Staff" value={dashboardNumber(staff?.total)} hint={staff?staff.statuses.ABSENT+' absent / '+staff.statuses.ON_LEAVE+' on leave / '+staff.statuses.NOT_MARKED+' unmarked':'Staff attendance source unavailable'} href="#staff-detail"/>}
    {(can('timetable.substitution.view')||(can('ATTENDANCE_VIEW')&&can('STAFF_VIEW')))&&data.sources.cover!=='restricted'&&<CommandMetric label="Coverage" value={<>{dashboardNumber(c?.unassigned)}<span className="cc-kpi-unit">uncovered</span></>} hint={c?c.required+' required / '+c.assigned+' assigned / '+c.pendingConfirmation+' confirmations pending':'Coverage source unavailable'} href={'/people/teacher-attendance?date='+data.clock.date}/>}
    <CommandMetric label="Actions due" value={dashboardNumber(data.pendingSummary?.total)} hint={data.pendingSummary?data.pendingSummary.urgent+' urgent / '+data.pendingSummary.overdue+' overdue'+(data.pendingSummary.partial?' / Partial queue':''):'Action summary unavailable'} href="#priority-actions"/>
   </section>
   {sourceIssues.length>0&&<div className="cc-source-notice" role="status"><span><strong>Partial operational view.</strong> {sourceIssues.length} data {sourceIssues.length===1?'source is':'sources are'} unavailable or incomplete. Available records remain visible.</span><button className="text-button" onClick={()=>openPanel('status')}>Review sources</button></div>}
   <CommandCenterBoard data={data} can={can} onOpen={openPanel}/>
  </>:<><section className="cc-metrics cc-overview-metrics" aria-label="School overview">{[['classes','Classes','/academics/classes','CLASS_VIEW'],['sections','Sections','/academics/classes','CLASS_VIEW'],['subjects','Subjects','/academics/subjects','SUBJECT_VIEW'],['staff','Staff','/people/staff','STAFF_VIEW']].filter(([, , ,permission])=>can(permission)).map(([id,label,href])=><CommandMetric key={id} label={label} value={dashboardNumber(data.counts[id])} hint={id==='classes'||id==='sections'?'Selected academic year':'Active school records'} href={href}/>)}</section><div className="cc-overview-grid"><section className="cc-surface" id="school-setup"><header className="cc-section-heading"><h2>School configuration</h2></header><p>{data.setup.completed} of {data.setup.total} configured</p><SetupChecklist steps={data.setup.steps}/></section><section className="cc-surface"><header className="cc-section-heading"><h2>School profile & configuration</h2></header><p>{data.school?.name?'School profile recorded':'School profile not configured'}</p><div className="cc-config-shortcuts">{data.setup.steps.filter(step=>step.href).map(step=><Link key={step.label} href={step.href!}>{step.label}</Link>)}</div><button className="text-button" onClick={()=>openPanel('calendar')}>Events and quick navigation</button></section></div></>}
  {panel&&<CommandDrawer title={titles[panel]} onClose={closePanel}>
   {panel==='actions'&&<CommandActionCenter data={data}/>}
   {panel==='attendance'&&<CommandAttendance data={data} canMark={can('ATTENDANCE_MARK')} canOpen={can('CLASS_VIEW')}/>}
   {panel==='staff'&&<CommandOperations data={data} canOpenStaff={can('staff.attendance.view')||can('ATTENDANCE_VIEW')} canOpenCover={can('timetable.substitution.view')||(can('ATTENDANCE_VIEW')&&can('STAFF_VIEW'))}/>}
   {panel==='queries'&&<ParentQueryWorkspace/>}
   {panel==='activities'&&<DailyActivityWorkspace date={data.clock.date} academicYearId={data.academicYear?.id}/>}
   {panel==='calendar'&&<><CommandTimeline data={data} onOpen={openPanel} expanded/>{activityPanel}</>}
   {panel==='configuration'&&<section className="cc-panel"><header><h2>Complete school configuration</h2></header>{outstanding&&<Link className="button" href={outstanding.href!}>Continue: {outstanding.label}</Link>}<SetupChecklist steps={data.setup.steps}/></section>}
   {panel==='status'&&<section className="cc-panel"><header><h2>Definitions & data availability</h2></header>{response.error&&<div role="alert"><strong>Refresh failed. Showing the last successful update.</strong><p>{response.error}</p></div>}<p>{data.scope}</p><ul>{data.notes.map(note=><li key={note}>{note}</li>)}</ul>{availability.length>0?<ul>{availability.map(([source,status])=><li key={source}>{source.replace(/([A-Z])/g,' $1')}: {status.replace(/-/g,' ')}{data.errors[source]?' | '+data.errors[source]:''}</li>)}</ul>:<p>All authorized sources are available.</p>}</section>}
  </CommandDrawer>}
 </div>;
}
const hashPanels:Record<string,CommandPanel>={'#priority-actions':'actions','#attendance-detail':'attendance','#staff-detail':'staff','#parent-queries':'queries','#daily-activities':'activities'};
