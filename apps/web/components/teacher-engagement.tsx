'use client';
import Link from '../lib/school-navigation';
import { useEffect, useState } from 'react';
import { useAcademicYear } from '../lib/academic-year-context';
import { useAuth } from '../lib/auth-context';
import { engagementApi } from '../lib/api';
import { DailyActivityWorkspace, ParentQueryWorkspace } from './engagement-workspace';
export function TeacherEngagement(){
 const {selectedId}=useAcademicYear(),{session}=useAuth(),[date,setDate]=useState(''),[year,setYear]=useState(''),[error,setError]=useState('');
 useEffect(()=>{let active=true;setDate('');setError('');if(!session)return;engagementApi.context(session.token).then(s=>{if(active){setDate(s.date);setYear(s.academicYearId||'');}}).catch(e=>active&&setError(e.message));return()=>{active=false;};},[session?.token]);
 return <><p><Link className="button secondary" href="/my-day">My Day: duties and substitute confirmations</Link></p>{error&&<p role="alert">{error}</p>}<div className="cc-command-grid">{date&&<div><label className="field">Activity date<input type="date" value={date} onChange={e=>e.target.value&&setDate(e.target.value)}/></label><DailyActivityWorkspace date={date} academicYearId={selectedId||year}/></div>}<ParentQueryWorkspace/></div></>;
}
