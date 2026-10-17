'use client';
import Link from 'next/link';
import {useState} from 'react';
import {useAuth} from '../lib/auth-context';
function unavailableReason(cover:any){
 if(!cover.canAssign)return'This period has ended or its timetable changed.';
 const people=(cover.rejected||[]).filter((t:any)=>!t.reasons.includes('Main teacher is unavailable'));
 const busy=people.filter((t:any)=>t.reasons.some((r:string)=>r.includes('Overlaps'))).length;
 const absent=people.filter((t:any)=>t.reasons.some((r:string)=>r.includes('absent')||r.includes('leave'))).length;
 const parts=[busy?busy+' busy':'',absent?absent+' absent/on leave':''].filter(Boolean);
 return parts.length?parts.join(', ')+'. No eligible free teacher is available.':'No eligible free teacher is available in this compartment.';
}
export function SubstitutionAction({cover,busy,choice,onChoice,onApprove,onOverride}:{cover:any;busy:boolean;choice:string;onChoice:(id:string)=>void;onApprove:()=>void;onOverride:(id:string,reason:string)=>Promise<any>}){
 const {can}=useAuth();const [alternate,setAlternate]=useState(''),[reason,setReason]=useState('');
 const canAssign=cover.canAssign&&(can('timetable.substitution.approve')||(can('TIMETABLE_UPDATE')&&can('STAFF_VIEW')));
 const free=(cover.rejected||[]).filter((t:any)=>t.canOverrideWorkload);
 if(cover.substituteTeacherId&&['APPROVED','SCHEDULED','COMPLETED'].includes(cover.status))return <span>{cover.status==='COMPLETED'?'Completed':'No action needed'}</span>;
 if(cover.candidates.length>0&&canAssign)return <div><select aria-label="Alternate staff" disabled={busy} value={choice||cover.substituteTeacherId||''} onChange={e=>onChoice(e.target.value)}><option value="">Choose alternate staff</option>{cover.candidates.map((t:any)=><option key={t.teacherId} value={t.teacherId}>{t.name}</option>)}</select><button className="button secondary" disabled={busy||!(choice||cover.substituteTeacherId)} onClick={onApprove}>Assign</button></div>;
 return <div><span className="danger-text">Teacher unavailable</span><small style={{display:'block'}}>{free.length?'Free staff exceed workload limits.':unavailableReason(cover)}</small>{canAssign&&<details><summary>Take action</summary>{free.length>0&&can('timetable.substitution.override')?<div><label>Free alternate<select aria-label="Manual alternate staff" value={alternate} disabled={busy} onChange={e=>setAlternate(e.target.value)}><option value="">Select staff</option>{free.map((t:any)=><option key={t.teacherId} value={t.teacherId}>{t.name}</option>)}</select></label><label>Reason<textarea aria-label="Workload override reason" maxLength={2000} value={reason} disabled={busy} onChange={e=>setReason(e.target.value)}/></label><button className="button secondary" disabled={busy||!alternate||reason.trim().length<3} onClick={()=>void onOverride(alternate,reason)}>Assign with workload exception</button></div>:<><p>Arrange cover or update staff eligibility, then generate again.</p><Link href="/people/teachers">Review staff eligibility</Link></>}</details>}</div>;
}
