'use client';
import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { ArrowDown, ArrowUp, ChevronRight, RefreshCw, Download, History, X, Search, Sparkles } from 'lucide-react';
import { analyticsViews } from '../lib/analytics-navigation';

export const reportLabel=(key:string)=>({currentActiveStudents:'Current active students',students:'Students in period',capacityPercent:'Current capacity used',attendanceCompleteness:'Attendance recorded',valid:'Numeric attempts',nonNumeric:'Grade-only results',amountMinor:'Amount (minor units)',pattern:'Assessment pattern'}[key]||key.replace(/([A-Z])/g,' $1').replace(/_/g,' ').replace(/^./,s=>s.toUpperCase()));
export function reportValue(v:any,key=''):string {
 if(v===null||v===undefined||v==='')return 'Not recorded';
 if(typeof v==='boolean')return v?'Yes':'No';
 if(typeof v==='number')return new Intl.NumberFormat('en-IN',{maximumFractionDigits:2}).format(v)+(key==='change'?' pp':/percent|percentage|coverage/i.test(key)||['average','median','highest','lowest'].includes(key)?'%':'');
 if(typeof v==='object')return JSON.stringify(v);
 if(/At$|Date$|^date$|^observedOn$/.test(key)&&/^\d{4}-\d{2}-\d{2}/.test(v)){const date=new Date(v);return Number.isNaN(+date)?String(v):date.toLocaleDateString('en-IN',{timeZone:'UTC',day:'numeric',month:'short',year:'numeric'});}
 return /^[A-Z][A-Z_]+$/.test(v)?reportLabel(v.toLowerCase()):String(v);
}
export function ReportShell({title,description,children,loading,busy,onRefresh,onHistory,onExport}:{title:string;description:string;children:ReactNode;loading:boolean;busy:boolean;onRefresh:()=>void;onHistory?:()=>void;onExport?:()=>void}) {
 return <div className="analytics-workspace intelligence-workspace"><header className="report-heading tw-flex tw-flex-wrap tw-items-start tw-justify-between tw-gap-3"><div><span className="eyebrow">School intelligence</span><h1>{title}</h1><p>{description}</p></div><div className="button-row">{onHistory&&<button className="button secondary" onClick={onHistory}><History size={15}/>Export history</button>}<button className="button secondary" disabled={loading||busy} onClick={onRefresh}><RefreshCw size={15}/>Refresh</button>{onExport&&<button className="button" disabled={loading||busy} onClick={onExport}><Download size={15}/>Export</button>}</div></header>{children}</div>;
}
export function MetricCard({label,value,hint}:{label:string;value:ReactNode;hint?:string}) {return <article className="report-metric"><span>{label}</span><strong>{value}</strong>{hint&&<small>{hint}</small>}</article>;}
export function ReportState({kind,title,detail,action}:{kind:'loading'|'empty'|'error'|'denied'|'partial';title:string;detail?:string;action?:ReactNode}) {
 return <div className={`report-state report-state-${kind}`} role={kind==='error'?'alert':'status'} aria-live="polite">{kind==='loading'&&<span className="spinner"/>}<div><strong>{title}</strong>{detail&&<p>{detail}</p>}{action}</div></div>;
}
export function ReportDataTable({title,rows,columns,onStudent,onDrilldown,serverTotal}:{title:string;rows:any[];columns:string[];onStudent?:(id:string)=>void;onDrilldown?:(row:any)=>void;serverTotal?:number}) {
 const [search,setSearch]=useState(''),[sort,setSort]=useState<{key:string;direction:1|-1}|null>(null),[page,setPage]=useState(1);const id=useId();
 const datasetKey=rows.map(row=>row.id||row.enrollmentId||row.key||JSON.stringify(row)).join('|');
 useEffect(()=>{setSearch('');setSort(null);setPage(1);},[datasetKey,title]);
 const filtered=useMemo(()=>{
  const selected=rows.filter(row=>columns.some(key=>reportValue(row[key],key).toLowerCase().includes(search.trim().toLowerCase())));
  if(sort)selected.sort((a,b)=>{const x=a[sort.key],y=b[sort.key];if(x===null||x===undefined)return y===null||y===undefined?0:1;if(y===null||y===undefined)return -1;return sort.direction*(typeof x==='number'&&typeof y==='number'?x-y:String(x).localeCompare(String(y),undefined,{numeric:true}));});
  return selected;
 },[rows,columns,search,sort]);
 const pages=Math.max(1,Math.ceil(filtered.length/10)),current=Math.min(page,pages),shown=filtered.slice((current-1)*10,current*10);
 return <section className="card report-table"><header className="report-table-heading"><div><h2 id={id}>{title}</h2><small>{serverTotal&&serverTotal>rows.length?`Search and sort apply to these ${rows.length} loaded rows of ${serverTotal}. Use dataset pages for more.`:`${rows.length} records`}</small></div>{rows.length>0&&<label className="report-table-search"><Search size={15} aria-hidden="true"/><input aria-label={`Search ${title}`} placeholder="Search loaded rows" value={search} onChange={e=>{setSearch(e.target.value);setPage(1);}}/></label>}</header>
 {!rows.length?<ReportState kind="empty" title="No recorded data" detail="Try a different period or filter. Missing records are not treated as zero."/>:!filtered.length?<ReportState kind="empty" title="No rows match your search" action={<button className="text-button" onClick={()=>setSearch('')}>Clear search</button>}/>:<><div className="table-wrap report-table-scroll" role="region" aria-label={title} tabIndex={0}><table><thead><tr>{columns.map(key=><th key={key} scope="col" aria-sort={sort?.key===key?(sort.direction===1?'ascending':'descending'):'none'}><button onClick={()=>{setSort({key,direction:sort?.key===key&&sort.direction===1?-1:1});setPage(1);}}>{reportLabel(key)}{sort?.key===key&&(sort.direction===1?<ArrowUp size={12}/>:<ArrowDown size={12}/>)}</button></th>)}{onDrilldown&&<th scope="col">Explore</th>}</tr></thead><tbody>{shown.map((row,i)=><tr key={row.id||row.enrollmentId||row.key||i}>{columns.map(key=><td key={key}>{key==='name'&&onStudent?<button className="text-button" onClick={()=>onStudent(row.enrollmentId)}>{row.name}</button>:reportValue(row[key],key)}</td>)}{onDrilldown&&<td><button className="text-button" aria-label={`Explore ${row.name||row.className||'record'} ${row.sectionName||''}`} onClick={()=>onDrilldown(row)}>Explore <ChevronRight size={13}/></button></td>}</tr>)}</tbody></table></div>{filtered.length>10&&<div className="report-pagination"><span>{(current-1)*10+1}–{Math.min(current*10,filtered.length)} of {filtered.length} loaded rows</span><div className="button-row"><button className="button secondary" disabled={current<=1} onClick={()=>setPage(current-1)}>Previous</button><button className="button secondary" disabled={current>=pages} onClick={()=>setPage(current+1)}>Next</button></div></div>}</>}
 </section>;
}
export function ReportSubviews({views,active,onSelect}:{views:string[];active:string;onSelect:(view:string)=>void}) {
 const names:Record<string,string>={academic:'Achievement',exams:'Exam completeness',subjects:'Subjects',attendance:'Attendance',homework:'Homework',teachers:'Staff workload',admissions:'Admissions',syllabus:'Lesson plans'};
 return views.length>1?<nav className="report-subviews" aria-label="Report subviews">{views.map(view=><button key={view} className={view===active?'active':''} aria-current={view===active?'page':undefined} onClick={()=>onSelect(view)}>{names[view]||analyticsViews.find(v=>v.key===view)?.label}</button>)}</nav>:null;
}
export function DrilldownDrawer({title,onClose,children}:{title:string;onClose:()=>void;children:ReactNode}) {
 const ref=useRef<HTMLDialogElement>(null);const id=useId();
 useEffect(()=>{const previous=document.activeElement as HTMLElement|null;const dialog=ref.current;const overflow=document.body.style.overflow;document.body.style.overflow='hidden';dialog?.showModal();return()=>{dialog?.close();document.body.style.overflow=overflow;previous?.focus();};},[]);
 return <dialog ref={ref} className="report-drawer" aria-labelledby={id} onCancel={e=>{e.preventDefault();onClose();}} onClick={e=>{if(e.target===e.currentTarget)onClose();}}><div className="report-drawer-surface"><header><h2 id={id}>{title}</h2><button className="icon-button" aria-label="Close panel" onClick={onClose}><X size={20}/></button></header>{children}</div></dialog>;
}
export function InsightPanel({insight,busy,onGenerate,onApprove,context,defaultOpen=false}:{insight:any;busy:boolean;context?:string;defaultOpen?:boolean;onGenerate:()=>void;onApprove:()=>void}) {
 return <details className="card report-insights" open={defaultOpen||undefined}><summary><Sparkles size={16}/> AI recommendations <span className="badge">{insight?.status==='APPROVED'?'Approved':'Draft · educator review required'}</span></summary><p>Generated from this snapshot's aggregate evidence. Recommendations are advisory.</p><button className="button secondary" disabled={busy} onClick={onGenerate}>{insight?'Regenerate draft':'Generate draft recommendations'}</button>{insight&&<><p>{insight.insights.caveat}</p>{insight.insights.findings.filter((finding:any)=>!context||finding.evidenceKey===context).length===0&&<ReportState kind="empty" title="No supported recommendations" detail="The current snapshot does not contain enough evidence for a finding."/>}{insight.insights.findings.filter((finding:any)=>!context||finding.evidenceKey===context).map((finding:any,i:number)=><article key={i}><span className="eyebrow">{finding.evidenceKey}</span><p>{finding.summary}</p><p>{finding.recommendation}</p></article>)}<small>{insight.fallback?'Fact-based fallback · ':''}{insight.inputTokens??'Unknown'} input / {insight.outputTokens??'Unknown'} output tokens · Monetary cost unavailable</small>{insight.canReview&&insight.status==='DRAFT'&&<button className="button" disabled={busy} onClick={onApprove}>Approve for report inclusion</button>}</>}</details>;
}

export function SnapshotStatus({report,onCopy}:{report:any;onCopy:()=>void}) {
 const [now,setNow]=useState(()=>Date.now());
 useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),60000);return()=>clearInterval(timer);},[]);
 const expired=Number.isFinite(Date.parse(report.expiresAt))&&now>=Date.parse(report.expiresAt);
 return <div className="report-snapshot" role="status"><span className="badge">{expired?'Snapshot expired ? refresh required':'Snapshot ready'}</span><span>Updated {new Date(report.asOf).toLocaleString('en-IN',{timeZone:report.period.timeZone})}</span><span>{report.period.from} to {report.period.to} ? {report.period.timeZone}</span><span>{report.studentTotal} matching enrollments</span><button className="text-button" onClick={onCopy}>Copy report link</button></div>;
}
