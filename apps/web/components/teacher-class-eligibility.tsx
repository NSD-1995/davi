'use client';
import {useEffect,useState} from 'react';
import {classApi,teacherApi,subjectApi} from '../lib/api';
import {responsibilityRows,GroupResponsibility} from '../lib/teaching-responsibilities';
import {useAuth} from '../lib/auth-context';
import {useToast} from '../lib/toast-context';
import {ErrorState,LoadingState} from './ui';
import {GroupResponsibilityTable} from './group-responsibility-table';

export function TeacherClassEligibility({teacherId,initial,capabilities=[],onSaved}:{teacherId:string;initial?:any;capabilities?:string[];onSaved:()=>void}){
 const {session,can}=useAuth(),{show}=useToast();
 const [classes,setClasses]=useState<any[]>([]),[subjects,setSubjects]=useState<any[]>([]);
 const [rows,setRows]=useState<GroupResponsibility[]>([]),[substitute,setSubstitute]=useState(false);
 const [configured,setConfigured]=useState(false),[clearRestrictions,setClearRestrictions]=useState(false),[busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[error,setError]=useState('');
 useEffect(()=>{if(!session)return;let active=true;setLoading(true);setError('');setClearRestrictions(false);
  Promise.all([classApi.list(session.token),subjectApi.list(session.token)]).then(([c,s])=>{if(!active)return;setClasses(c);setSubjects(s);setRows(responsibilityRows({capableSubjectIds:capabilities,timetableEligibility:initial},s,c));setConfigured(Array.isArray(initial?.groupResponsibilities));setSubstitute(initial?.canSubstitute===true);}).catch(e=>{if(active)setError(e.message)}).finally(()=>{if(active)setLoading(false)});
  return()=>{active=false};
 },[session?.token,teacherId,JSON.stringify(initial),JSON.stringify(capabilities)]);
 const save=async()=>{if(!session)return;setBusy(true);setError('');try{
  await teacherApi.saveTeachingSetup(session.token,teacherId,{groupResponsibilities:rows,allowedClassIds:clearRestrictions?null:initial?.allowedClassIds??null,preferredClassIds:initial?.preferredClassIds||[],canSubstitute:substitute});
  setConfigured(true);show('Compartment responsibilities saved. Review and regenerate affected timetables.');onSaved();
 }catch(e){setError(e instanceof Error?e.message:'Teaching setup could not be saved.')}finally{setBusy(false)}};
 return <section className="card"><h2>Teacher teaching responsibilities</h2><p>Add every compartment this teacher works in. Choose subjects and classes separately for each compartment. One shared availability and workload applies to all.</p>{error&&<ErrorState message={error}/>}{loading?<LoadingState/>:<fieldset disabled={busy||!can('STAFF_UPDATE')} style={{border:0,padding:0}}>
 {!configured&&<p className="alert">These rows reflect the existing broad teaching setup. Review and save to make responsibilities explicit. Remove compartments the teacher does not teach.</p>}
 <GroupResponsibilityTable rows={rows} onChange={setRows} subjects={subjects} classes={classes} disabled={busy||!can('STAFF_UPDATE')}/>
 {!rows.length&&<p>No compartment responsibility. Saving this prevents automatic teaching and substitution until a compartment is added.</p>}
 <label className="checkbox"><input type="checkbox" checked={substitute} onChange={e=>setSubstitute(e.target.checked)}/>Available for substitution within these responsibilities when present and free</label>
 {Array.isArray(initial?.allowedClassIds)&&<label className="checkbox"><input type="checkbox" checked={clearRestrictions} onChange={e=>setClearRestrictions(e.target.checked)}/>Replace the older allowed-class restriction with the Classes selections above</label>}
 {can('STAFF_UPDATE')&&<button className="button" onClick={()=>void save()}>{busy?'Saving…':'Save teaching responsibilities'}</button>}
 </fieldset>}</section>;
}
