import {teachingExclusion} from '../teaching-responsibilities';
import {allowedForClass} from './teacher-eligibility';
export function eligibleTeachers(subjectId:string,teachers:Array<{id:string;capableSubjectIds?:string[];timetableEligibility?:unknown}>,allocations:Array<{teacherId:string}>,restrictedIds:string[]=[],classId?:string,schoolClass?:{name?:string;academicGroup?:string|null}):string[]{
 const ids=[...new Set([...teachers.filter(t=>t.capableSubjectIds?.includes(subjectId)).map(t=>t.id),...allocations.filter(a=>teachers.some(t=>t.id===a.teacherId&&!t.capableSubjectIds?.length&&!((t.timetableEligibility||{}) as any).capabilitiesConfigured)).map(a=>a.teacherId)])];
 return ids.filter(id=>(!restrictedIds.length||restrictedIds.includes(id))&&(!classId||teachers.some(t=>t.id===id&&allowedForClass(t,classId,schoolClass)&&(!Array.isArray((t.timetableEligibility as any)?.groupResponsibilities)||!teachingExclusion(t,classId,schoolClass||{},subjectId))))).sort();
}
