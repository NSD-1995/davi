'use client';
import {teachingExclusion} from '../lib/teaching-responsibilities';
import {academicGroup,subjectInGroup} from '../lib/academic-groups';
import { useEffect, useState } from 'react';
import { ApiError, classApi, classWorkspaceApi, staffApi, teacherApi } from '../lib/api';
import { useAuth } from '../lib/auth-context';
import { useAcademicYear } from '../lib/academic-year-context';
import { useToast } from '../lib/toast-context';
import { EmptyState, ErrorState, Field, LoadingState } from './ui';
import type { SchoolClass, Subject } from '../lib/types';

type Assignment = { staffId: string; subjectId: string; assignmentRole: string };
export function TeacherSubjectAssignments({teacherId,userId,onSaved}:{teacherId:string;userId:string;onSaved?:()=>void}) {
  const { session, can } = useAuth();
  const { selected } = useAcademicYear();
  const { show } = useToast();
  const [profile,setProfile]=useState<any>();
  const [capabilities,setCapabilities]=useState<string[]>([]);
  const [classes,setClasses] = useState<SchoolClass[]>([]);
  const [staffId,setStaffId] = useState('');
  const [classId,setClassId] = useState('');
  const [sectionId,setSectionId] = useState('');
  const [subjects,setSubjects] = useState<Subject[]>([]);
  const [existing,setExisting] = useState<Assignment[]>([]);
  const [checked,setChecked] = useState<string[]>([]);
  const [initial,setInitial] = useState<string[]>([]);
  const [loading,setLoading] = useState(false);
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState('');
  useEffect(() => {
    let active = true;
    setClassId(''); setSectionId(''); setClasses([]); setStaffId(''); setError('');
    if (!session?.user.schoolId || !selected) return;
    setLoading(true);
    Promise.all([classApi.list(session.token),staffApi.list(session.token,session.user.schoolId),teacherApi.get(session.token,teacherId)])
      .then(([items,staff,teacher]) => { if(active){setProfile(teacher);setCapabilities(teacher.capableSubjectIds||[]);setClasses(items.filter(c=>c.academicYearId===selected.id&&!teachingExclusion(teacher,c.id,c)&&(!Array.isArray(teacher.timetableEligibility?.allowedClassIds)||teacher.timetableEligibility.allowedClassIds.includes(c.id))));const member=staff.find(s=>s.userId===userId);if(!member)throw new Error('No staff profile is linked to this teacher.');setStaffId(member.id);} })
      .catch(e=>{if(active)setError(e instanceof Error?e.message:'Assignments could not be loaded.');})
      .finally(()=>{if(active)setLoading(false);});
    return ()=>{active=false;};
  },[session?.token,selected?.id,teacherId,userId]);
  useEffect(() => {
    let active = true;
    setSubjects([]); setExisting([]); setChecked([]); setInitial([]); setError('');
    if(!session || !selected || !classId || !sectionId || !staffId) return;
    setLoading(true);
    Promise.all([classApi.assignedSubjects(session.token,selected.id,classId),classWorkspaceApi.subjectTeachers(session.token,selected.id,classId,sectionId)])
      .then(([result,rows])=>{if(active){setSubjects(result.subjects.filter(subject=>subjectInGroup(subject,academicGroup(classes.find(c=>c.id===classId)||{}))));const assignments=rows.assignments.map(r=>({staffId:String(r.staffId||''),subjectId:String(r.subjectId),assignmentRole:String(r.assignmentRole)}));setExisting(assignments);const ids=assignments.filter(r=>r.staffId===staffId&&r.assignmentRole==='PRIMARY').map(r=>r.subjectId);setChecked(ids);setInitial(ids);}})
      .catch(e=>{if(active)setError(e instanceof ApiError?e.message:'Subject assignments could not be loaded.');})
      .finally(()=>{if(active)setLoading(false);});
    return ()=>{active=false;};
  },[session?.token,selected?.id,classId,sectionId,staffId]);
  const save=async()=>{
    if(!session||!selected)return;
    setBusy(true);
    try{
      const retained=existing.filter(r=>!(r.staffId===staffId&&r.assignmentRole==='PRIMARY'));
      const assignments=[...retained,...checked.map(subjectId=>({staffId,subjectId,assignmentRole:'PRIMARY'}))];
      await classWorkspaceApi.saveSubjectTeachers(session.token,selected.id,classId,sectionId,assignments);
      setExisting(assignments);setInitial([...checked]);show('Teacher subjects saved for this class section.');onSaved?.();
    }catch(e){show(e instanceof ApiError?e.message:'Subjects could not be saved.','error');}finally{setBusy(false);}
  };
  if(!selected)return <EmptyState title="Select an academic year" detail="Choose an academic year before assigning teacher subjects."/>;
  const current=classes.find(c=>c.id===classId);
  const dirty=[...checked].sort().join()!==[...initial].sort().join();
  return <section className="card"><h2>Assign subjects and classes</h2><p>{selected.name} · A teacher can teach multiple subjects across multiple classes. Select a class and section, choose subjects, and save before moving to another section.</p>
    <div className="form-grid two">
      <Field label="Class"><select disabled={busy||loading} value={classId} onChange={e=>{setClassId(e.target.value);setSectionId('');}}><option value="">Select class</option>{classes.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
      <Field label="Section"><select disabled={busy||loading||!classId} value={sectionId} onChange={e=>setSectionId(e.target.value)}><option value="">Select section</option>{current?.sections.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></Field>
    </div>
    {error?<ErrorState message={error}/>:loading?<LoadingState/>:sectionId&&!subjects.length?<EmptyState title="No subjects assigned to this class" detail="Add subjects in Classes & Sections first."/>:sectionId?<div className="check-list">{subjects.map(subject=>{const incapable=!!teachingExclusion(profile||{},classId,current||{},subject.id);const occupied=existing.some(r=>r.subjectId===subject.id&&r.assignmentRole==='PRIMARY'&&r.staffId!==staffId);return <label key={subject.id}><input type="checkbox" disabled={busy||occupied||incapable||!can('SUBJECT_TEACHER_MANAGE')} checked={checked.includes(subject.id)} onChange={e=>setChecked(e.target.checked?[...checked,subject.id]:checked.filter(id=>id!==subject.id))}/>{subject.name}{incapable&&<small> | Add this responsible subject in teaching setup first.</small>}{occupied&&<small> · Primary teacher already assigned. Change it in the class workspace.</small>}</label>;})}</div>:null}
    {sectionId&&can('SUBJECT_TEACHER_MANAGE')&&<div className="form-actions"><button className="button secondary" disabled={busy||!dirty} onClick={()=>setChecked([...initial])}>Cancel changes</button><button className="button" disabled={busy||loading||!!error||!staffId||!dirty} onClick={()=>void save()}>{busy?'Saving…':'Save subject assignments'}</button></div>}
  </section>;
}
