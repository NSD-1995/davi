'use client';
import { useEffect, useState } from 'react';
import { assessmentApi } from '../lib/api';
import { useAuth } from '../lib/auth-context';
export function ParentAssessmentReports({enrollmentId}:{enrollmentId:string}){
 const {session}=useAuth();const [reports,setReports]=useState<any[]>([]),[error,setError]=useState(''),[loading,setLoading]=useState(false);
 useEffect(()=>{let active=true;setReports([]);setError('');if(!session||!enrollmentId)return;setLoading(true);assessmentApi.parent(session.token,enrollmentId).then(r=>active&&setReports(r)).catch(e=>active&&setError(e.message)).finally(()=>active&&setLoading(false));return()=>{active=false;};},[session?.token,enrollmentId]);
 if(!enrollmentId)return null;
 return <section className="card"><h2>Published progress cards</h2>{error&&<p role="alert">{error}</p>}{loading?<p role="status">Loading report cards...</p>:!reports.length?<p>No progress cards have been published yet.</p>:reports.map(r=><article key={r.id}><h3>{r.snapshot.assessment.name} / {r.snapshot.assessment.termKey}</h3><p>Version {r.version} / Published {new Date(r.publishedAt).toLocaleDateString()}</p><button className="button secondary" onClick={()=>void assessmentApi.download(session!.token,r.id,true).catch(e=>setError(e.message))}>Download progress card PDF</button></article>)}</section>;
}
