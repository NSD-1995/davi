'use client';
import Link from 'next/link';
import { WorkspaceLoading } from '../../../../components/workspace-loading';
import {useEffect,useMemo,useState} from 'react';
import {ApiError,classWorkspaceApi} from '../../../../lib/api';
import {useAcademicYear} from '../../../../lib/academic-year-context';
import {useAuth} from '../../../../lib/auth-context';
import {EmptyState,ErrorState,Field,PageHeader,StatusBadge} from '../../../../components/ui';
import type {ClassWorkspace} from '../../../../lib/types';
export default function AcademicWorkspacePage(){
 const{session,can}=useAuth();const{selected}=useAcademicYear();const[rows,setRows]=useState<ClassWorkspace[]>([]);const[loading,setLoading]=useState(true);const[error,setError]=useState('');const[search,setSearch]=useState('');
 useEffect(()=>{let active=true;setRows([]);setError('');if(!session||!selected){setLoading(false);return;}setLoading(true);classWorkspaceApi.list(session.token,selected.id).then(items=>{if(active)setRows(items)}).catch(e=>{if(active)setError(e instanceof ApiError?e.message:'Workspace could not be loaded.')}).finally(()=>{if(active)setLoading(false)});return()=>{active=false}},[session?.token,selected?.id]);
 const filtered=useMemo(()=>{const query=search.trim().toLowerCase();return rows.map(item=>({...item,sections:item.sections.filter(section=>!query||[item.name,item.code,section.name,section.room,section.classTeacherDetails?.firstName,section.classTeacherDetails?.lastName,section.classTeacherDetails?.teacherCode,section.classTeacherDetails?[section.classTeacherDetails.firstName,section.classTeacherDetails.lastName].join(' '):''].some(value=>value?.toLowerCase().includes(query)))})).filter(item=>item.sections.length||!item.sectionCount&&(!query||item.name.toLowerCase().includes(query)))},[rows,search]);
 return <><PageHeader title="Class Workspace" description={selected?selected.name+' · View class, section and class teacher details.':'Select an academic year to open the workspace.'}/>
 {can('STUDENT_VIEW')&&rows.some(row=>row.unassignedStudentCount)&&<section className="card"><p>Confirmed students are waiting for section allocation.</p><Link className="button secondary" href="/students/unassigned">View unassigned students</Link></section>}
 {loading?<WorkspaceLoading/>:!selected?<EmptyState title="No academic year selected" detail="Select an academic year from the header first."/>:error?<ErrorState message={error}/>:!rows.length?<EmptyState title="No classes yet" detail="Create classes and sections before opening the workspace."/>:<>

 <section className="card"><Field label="Search classes, sections or class teachers"><input type="search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Class, section, teacher name or code"/></Field>
 {!filtered.length?<EmptyState title="No matching classes or sections"/>:<div className="table-wrap"><table><thead><tr><th>Class</th><th>Section</th><th>Class teacher</th><th>Students</th><th>Subject teachers</th><th>Today’s attendance</th><th>Status</th><th>Workspace</th></tr></thead><tbody>{filtered.flatMap(item=>item.sections.length?item.sections.map(section=>{const teacher=section.classTeacherDetails;return <tr key={section.id}>
 <td><strong>{item.name}</strong>{item.code&&<small style={{display:'block'}}>{item.code}</small>}<small style={{display:'block'}}>{item.sectionCount} section(s) · {item.studentCount} students in class</small></td>
 <td><strong>{section.name}</strong><small style={{display:'block'}}>{section.room?'Room '+section.room:'Room not set'}{section.capacity?' · '+section.capacity+' seats':''}</small></td>
 <td>{teacher?<>{can('STAFF_VIEW')?<Link className="record-link" href={'/people/teachers/'+teacher.id}>{teacher.firstName} {teacher.lastName}</Link>:<strong>{teacher.firstName} {teacher.lastName}</strong>}<small style={{display:'block'}}>{teacher.teacherCode}</small></>:<span className="danger-text">Not assigned</span>}</td>
 <td>{section.studentCount}</td><td>{section.subjectTeacherCount}</td><td>{section.todayAttendance.present} present · {section.todayAttendance.absent} absent<small style={{display:'block'}}>{section.todayAttendance.notMarked} not marked</small></td><td><StatusBadge status={section.status||item.status||'ACTIVE'}/></td><td><Link className="button secondary" href={'/academics/workspace/'+item.id+'/sections/'+section.id+'?year='+selected.id}>Open workspace</Link></td>
 </tr>}):[<tr key={item.id}><td><strong>{item.name}</strong>{item.code&&<small style={{display:'block'}}>{item.code}</small>}</td><td colSpan={5}><span className="muted">No sections yet. Add a section in Classes & Sections.</span></td><td><StatusBadge status={item.status||'ACTIVE'}/></td><td>{can('CLASS_VIEW')&&<Link className="text-button" href="/academics/classes">Manage class</Link>}</td></tr>])}</tbody></table></div>}
 </section></>}
 </>;
}
