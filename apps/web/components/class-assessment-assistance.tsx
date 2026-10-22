'use client';
import { useEffect, useState } from 'react';
import { AssessmentAssistance } from './assessment-assistance';
import { assessmentApi } from '../lib/api';
import { useAuth } from '../lib/auth-context';
import { Field, LoadingState } from './ui';
export function ClassAssessmentAssistance({academicYearId,classId,sectionId}:{academicYearId:string;classId:string;sectionId:string}){
 const {session}=useAuth(),[assessments,setAssessments]=useState<any[]>([]),[selected,setSelected]=useState(''),[detail,setDetail]=useState<any>(null),[loading,setLoading]=useState(true),[error,setError]=useState('');
 useEffect(()=>{let active=true;setLoading(true);setError('');setSelected('');setDetail(null);if(session)assessmentApi.list(session.token,{academicYearId,classId,sectionId}).then(rows=>{if(active)setAssessments(rows);}).catch(e=>active&&setError(e.message)).finally(()=>active&&setLoading(false));return()=>{active=false;};},[session?.token,academicYearId,classId,sectionId]);
 useEffect(()=>{let active=true;setDetail(null);setError('');if(session&&selected)assessmentApi.detail(session.token,selected).then(d=>active&&setDetail(d)).catch(e=>active&&setError(e.message));return()=>{active=false;};},[session?.token,selected]);
 const reload=async()=>{if(session&&selected)setDetail(await assessmentApi.detail(session.token,selected));};
 return <><section className="card"><h2>AI Drafting</h2><p>Create question papers, worksheets, answer keys and other teaching drafts for this class.</p>{error&&<p role="alert">{error}</p>}{loading?<LoadingState/>:!assessments.length?<p>Open a configured term in Exams &amp; Marks first, then select it here for drafting.</p>:<Field label="Assessment"><select value={selected} onChange={e=>setSelected(e.target.value)}><option value="">Choose assessment</option>{assessments.map(a=><option key={a.id} value={a.id}>{a.termKey} / {a.name} / {a.status}</option>)}</select></Field>}</section>{selected&&!detail&&!error&&<LoadingState/>}{detail&&<AssessmentAssistance key={detail.exam.id} exam={detail.exam} onSaved={reload}/>}</>;
}
