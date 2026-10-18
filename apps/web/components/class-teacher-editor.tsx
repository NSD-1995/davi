'use client';
import {teachingExclusion} from '../lib/teaching-responsibilities';
import {useEffect,useState} from 'react';
import {ApiError,classWorkspaceApi} from '../lib/api';
import {useAuth} from '../lib/auth-context';
import {useToast} from '../lib/toast-context';
import {Field,Modal} from './ui';
export function ClassTeacherEditor({yearId,classId,sectionId,current,teachers,reload,schoolClass}:{yearId:string;classId:string;sectionId:string;schoolClass?:{name?:string;academicGroup?:string|null};current:any;teachers:any[];reload:()=>Promise<void>}){
 const {session,can}=useAuth();const{show}=useToast();const[editing,setEditing]=useState(false);const[teacherId,setTeacherId]=useState('');const[busy,setBusy]=useState(false);
 useEffect(()=>{setEditing(false);setTeacherId('');},[yearId,classId,sectionId]);
 const save=async()=>{if(!session||!teacherId)return;setBusy(true);try{await classWorkspaceApi.classTeacher(session.token,yearId,classId,sectionId,teacherId);await reload();setEditing(false);setTeacherId('');show('Class teacher updated.');}catch(e){show(e instanceof ApiError?e.message:'Could not change class teacher.','error');}finally{setBusy(false)}};
 if(!can('STAFF_UPDATE'))return null;
 return <><button className="button secondary" onClick={()=>{setTeacherId(current?.teacher.id||'');setEditing(true);}}>{current?'Change class teacher':'Assign class teacher'}</button>
 {editing&&<Modal title={current?'Change class teacher':'Assign class teacher'} onClose={()=>{if(!busy)setEditing(false);}}><p>{current?'Current class teacher: '+current.teacher.user.firstName+' '+current.teacher.user.lastName:'No class teacher assigned.'}</p><Field label="Class teacher"><select disabled={busy} value={teacherId} onChange={e=>setTeacherId(e.target.value)}><option value="">Select teacher</option>{teachers.filter(t=>!teachingExclusion(t,classId,schoolClass||{})).map(t=>{const disallowed=Array.isArray(t.timetableEligibility?.allowedClassIds)&&!t.timetableEligibility.allowedClassIds.includes(classId);const other=t.classTeacherAssignments?.find((a:any)=>a.classId!==classId||a.sectionId!==sectionId);return <option key={t.id} value={t.id} disabled={!!other||disallowed}>{t.user.firstName} {t.user.lastName}{disallowed?' · Not allowed for this class':other?' · Already class teacher: '+other.schoolClass.name+' / '+(other.section?.name||'All sections'):''}</option>})}</select></Field><p className="muted">A teacher can be class teacher for one class section per academic year. Teachers assigned elsewhere cannot be selected.</p><div className="button-row"><button className="button" disabled={busy||!teacherId||teacherId===current?.teacher.id} onClick={()=>void save()}>{busy?'Saving…':current?'Save class teacher':'Assign class teacher'}</button><button className="button secondary" disabled={busy} onClick={()=>setEditing(false)}>Cancel</button></div></Modal>}
 </>;
}
