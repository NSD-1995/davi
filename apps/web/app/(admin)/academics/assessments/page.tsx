'use client';
import { useEffect, useState } from 'react';
import { AssessmentWorkspace } from '../../../../components/assessment-workspace';
import { AssessmentAiSettings } from '../../../../components/assessment-assistance';
import { classWorkspaceApi, subjectApi } from '../../../../lib/api';
import { useAuth } from '../../../../lib/auth-context';
import { useAcademicYear } from '../../../../lib/academic-year-context';
import { EmptyState, ErrorState, LoadingState, PageHeader } from '../../../../components/ui';
import type { ClassWorkspace } from '../../../../lib/types';
export default function AssessmentSetupPage(){
 const {session,can}=useAuth(),{selectedId}=useAcademicYear();
 const [classes,setClasses]=useState<ClassWorkspace[]>([]),[subjects,setSubjects]=useState<any[]>([]),[loading,setLoading]=useState(false),[error,setError]=useState('');
 useEffect(()=>{let active=true;setClasses([]);setError('');if(!session||!selectedId)return;setLoading(true);Promise.all([classWorkspaceApi.list(session.token,selectedId),subjectApi.list(session.token)]).then(([rows,subjectRows])=>{if(active){setClasses(rows);setSubjects(subjectRows);}}).catch(e=>active&&setError(e.message)).finally(()=>active&&setLoading(false));return()=>{active=false;};},[session?.token,selectedId]);
 if(!can('ASSESSMENT_CONFIGURE'))return <EmptyState title="Assessment setup access required" detail="Ask your school administrator for assessment configuration permission."/>;
 return <><PageHeader title="Assessment Setup" description="Configure assessment patterns and apply them to classes. Their terms appear automatically in Class Workspace for marks and observations."/>{error&&<ErrorState message={error}/>}{!selectedId?<EmptyState title="Select an academic year"/>:loading?<LoadingState/>:<><AssessmentWorkspace key={selectedId} configurationOnly mode="setup" availableClasses={classes} academicYearId={selectedId} classId="" sectionId="" subjects={subjects}/><AssessmentAiSettings/></>}</>;
}
