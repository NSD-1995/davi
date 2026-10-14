'use client';
import {useSchoolAcademicGroups} from '../lib/school-academic-groups-context';
import {subjectInConfiguredGroups} from '../lib/academic-groups';
import {useEffect,useState} from 'react';
import {ApiError,subjectApi,teacherApi} from '../lib/api';
import {useAuth} from '../lib/auth-context';
import {useToast} from '../lib/toast-context';
import {EmptyState,ErrorState,LoadingState} from './ui';
import type{Subject}from'../lib/types';
export function TeacherCapabilities({teacherId,initial=[],onSaved}:{teacherId:string;initial?:string[];onSaved?:()=>void}){
 const{groups:schoolGroups}=useSchoolAcademicGroups();
 const{session,can}=useAuth();const{show}=useToast();const[subjects,setSubjects]=useState<Subject[]>([]);const[chosen,setChosen]=useState<string[]>(initial);const[loading,setLoading]=useState(true);const[busy,setBusy]=useState(false);const[error,setError]=useState('');
 useEffect(()=>{setChosen(initial)},[teacherId,JSON.stringify(initial)]);
 useEffect(()=>{if(!session)return;let active=true;setLoading(true);subjectApi.list(session.token).then(rows=>{if(active)setSubjects(rows)}).catch(e=>{if(active)setError(e.message)}).finally(()=>{if(active)setLoading(false)});return()=>{active=false}},[session?.token]);
 const save=async()=>{if(!session)return;setBusy(true);setError('');try{await teacherApi.saveCapabilities(session.token,teacherId,chosen);show('Capable subjects saved.');onSaved?.();}catch(e){setError(e instanceof ApiError?e.message:'Capabilities could not be saved.')}finally{setBusy(false)}};
 const dirty=[...chosen].sort().join()!==[...initial].sort().join();
 return <section className="card"><h2>Capable subjects</h2><p>Select all subjects this teacher can teach. Timetable generation can use this teacher in any class where those subjects are assigned, subject to availability and workload limits.</p>{error&&<ErrorState message={error}/>} {loading?<LoadingState/>:!subjects.length?<EmptyState title="Create subjects first"/>:<div className="check-list">{subjects.filter(subject=>subjectInConfiguredGroups(subject,schoolGroups)).map(subject=><label key={subject.id}><input type="checkbox" checked={chosen.includes(subject.id)} disabled={busy||!can('STAFF_UPDATE')} onChange={e=>setChosen(e.target.checked?[...chosen,subject.id]:chosen.filter(id=>id!==subject.id))}/><span><strong>{subject.name}</strong><small>{subject.code}{subject.status==='INACTIVE'?' · Inactive subject':''}</small></span></label>)}</div>}{can('STAFF_UPDATE')&&<div className="form-actions"><button className="button secondary" disabled={busy||!dirty} onClick={()=>setChosen(initial)}>Cancel changes</button><button className="button" disabled={busy||!dirty} onClick={()=>void save()}>{busy?'Saving…':'Save capable subjects'}</button></div>}</section>;
}
