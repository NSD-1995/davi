'use client';
import {TeacherClassEligibility} from '../../../../../components/teacher-class-eligibility';
import {TeacherCapabilities} from '../../../../../components/teacher-capabilities';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { TeacherSubjectAssignments } from '../../../../../components/teacher-subject-assignments';
import { ApiError, teacherApi } from '../../../../../lib/api';
import { useAuth } from '../../../../../lib/auth-context';
import { EmptyState, ErrorState, LoadingState, PageHeader, StatusBadge } from '../../../../../components/ui';

const label = (value?: string) => value ? value.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase()) : 'Subject teacher';
export default function TeacherDashboardPage() {
  const { session, can } = useAuth();
  const { teacherId } = useParams<{teacherId:string}>();
  const [teacher,setTeacher] = useState<any>(null);
  const [assignments,setAssignments] = useState<any[]>([]);
  const [error,setError] = useState('');
  const [removing,setRemoving]=useState<string|null>(null);
  const [removalError,setRemovalError]=useState('');
  const [editorVersion,setEditorVersion]=useState(0);
  const load = async () => {
    if (!session) return;
    setError('');
    try {
      const [t,a] = await Promise.all([teacherApi.get(session.token,teacherId),teacherApi.assignments(session.token,teacherId)]);
      setTeacher(t); setAssignments(a);
    } catch(e) { setError(e instanceof ApiError ? e.message : 'Teacher dashboard could not be loaded.'); }
  };
  const removeSubject=async(assignment:any)=>{
    if(!session||!window.confirm('Remove '+assignment.subject.name+' from this teacher for '+assignment.schoolClass.name+' / '+(assignment.section?.name||'All sections')+'?'))return;
    setRemoving(assignment.id);setRemovalError('');
    try{await teacherApi.removeSubjectAssignment(session.token,teacherId,assignment.id);await load();setEditorVersion(v=>v+1);}catch(e){setRemovalError(e instanceof ApiError?e.message:'Subject assignment could not be removed.');}finally{setRemoving(null);}
  };
  useEffect(()=>{setTeacher(null);void load();},[session?.token,teacherId]);
  if(error) return <ErrorState message={error} retry={()=>void load()}/>;
  if(!teacher) return <LoadingState label="Loading teacher details…"/>;
  const active = assignments.filter(a=>a.isActive !== false);
  const history = assignments.filter(a=>a.isActive === false);
  const subjectAssignments = active.filter(a=>a.subjectId);
  const responsibilities = active.filter(a=>!a.subjectId);
  const groups = new Map<string,any[]>();
  for(const assignment of subjectAssignments) {
    const key = [assignment.academicYearId,assignment.classId,assignment.sectionId||'all'].join(':');
    groups.set(key,[...(groups.get(key)||[]),assignment]);
  }
  return <>
    <PageHeader title={teacher.user.firstName+' '+teacher.user.lastName} description="Teacher profile, existing subjects and class responsibilities" action={<Link className="button secondary" href="/people/teachers">Back to teachers</Link>}/>
    <section className="metric-grid">
      {[[ 'Teacher code',teacher.teacherCode ],['Active assignments',active.length],['Classes',new Set(active.map(a=>a.classId)).size],['Sections',new Set(active.filter(a=>a.sectionId).map(a=>a.sectionId)).size],['Capable subjects',(teacher.capableSubjectIds||[]).length],['Assigned subjects',new Set(subjectAssignments.map(a=>a.subjectId)).size]].map(([name,value])=><article className="metric-card" key={String(name)}><strong>{value}</strong><p>{name}</p></article>)}
    </section>
    <section className="card"><h2>Teacher details</h2><div className="detail-grid">
      <p><strong>Status</strong><br/><StatusBadge status={teacher.status}/></p>
      <p><strong>Specialization</strong><br/>{teacher.specialization||'—'}</p>
      <p><strong>Qualification</strong><br/>{teacher.qualification||'—'}</p>
      <p><strong>Email</strong><br/>{teacher.user.email||'—'}</p>
      <p><strong>Phone</strong><br/>{teacher.user.phone||'—'}</p>
      <p><strong>Hire date</strong><br/>{teacher.hireDate?new Date(teacher.hireDate).toLocaleDateString('en-IN'):'—'}</p>
    </div></section>
    <TeacherClassEligibility teacherId={teacherId} capabilities={teacher.timetableEligibility?.capabilitiesConfigured||teacher.capableSubjectIds?.length?teacher.capableSubjectIds||[]:[...new Set(subjectAssignments.map(a=>a.subjectId))]} initial={teacher.timetableEligibility} onSaved={()=>void load()}/><section className="card"><h2>Subjects already assigned</h2>{removalError&&<ErrorState message={removalError}/>}<p>All active subject assignments across academic years, grouped by class and section. These details refresh after saving new assignments.</p>
      {!groups.size?<EmptyState title="No subjects assigned yet"/>:<div className="class-grid">{Array.from(groups.values()).map(rows=>{
        const first=rows[0];
        return <article className="assignment-card" key={[first.academicYearId,first.classId,first.sectionId].join(':')}><div>
          <span className="eyebrow">{first.academicYear?.name||'Academic year'}</span>
          <h3>{first.schoolClass?.name||'Class'} · {first.section? 'Section '+first.section.name:'All sections'}</h3>
          <div className="table-wrap"><table><thead><tr><th>Subject</th><th>Code</th><th>Role</th>{can('SUBJECT_TEACHER_MANAGE')&&<th>Action</th>}</tr></thead><tbody>{rows.map(a=><tr key={a.id}><td><strong>{a.subject?.name||'—'}</strong></td><td>{a.subject?.code||'—'}</td><td>{label(a.assignmentRole)}</td>{can('SUBJECT_TEACHER_MANAGE')&&<td><button className="text-button danger-text" disabled={removing!==null} onClick={()=>void removeSubject(a)}>{removing===a.id?'Removing…':'Remove'}</button></td>}</tr>)}</tbody></table></div>
        </div></article>;
      })}</div>}
    </section>
    <AssignmentTable title="Class teacher and other responsibilities" rows={responsibilities}/>
    {can('SUBJECT_TEACHER_VIEW')&&<TeacherSubjectAssignments key={editorVersion} teacherId={teacherId} userId={teacher.userId} onSaved={()=>void load()}/>}
    {!!history.length&&<details className="card"><summary>Previous assignments ({history.length})</summary><AssignmentTable title="Assignment history" rows={history}/></details>}
  </>;
}
function AssignmentTable({title,rows}:{title:string;rows:any[]}) {
  return <section className="card"><h2>{title}</h2>{!rows.length?<EmptyState title="No assignments"/>:<div className="table-wrap"><table><thead><tr><th>Academic year</th><th>Class</th><th>Section</th><th>Subject</th><th>Responsibility</th><th>Status</th></tr></thead><tbody>{rows.map(a=><tr key={a.id}><td>{a.academicYear?.name||'—'}</td><td>{a.schoolClass?.name||'—'}</td><td>{a.section?.name||'All sections'}</td><td>{a.subject?.name||'—'}</td><td>{a.isClassTeacher?'Class teacher':label(a.assignmentRole||a.responsibilityType)}</td><td><StatusBadge status={a.isActive===false?'INACTIVE':'ACTIVE'}/></td></tr>)}</tbody></table></div>}</section>;
}
