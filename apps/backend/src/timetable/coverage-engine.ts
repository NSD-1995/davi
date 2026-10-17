import {academicGroup} from '../academic-groups';
import {teachingExclusion} from '../teaching-responsibilities';
import {allowedForClass} from './teacher-eligibility';
export interface CoverTarget {key:string;entryId?:string;planId:string;slotId:string;teacherId:string;classId:string;sectionId:string;subjectId:string|null;subjectName:string;className:string;academicGroup?:string|null;sectionName:string;startTime:string;endTime:string;sequence?:number;academicYearId?:string;room?:string|null;}
export interface CoverTeacher {id:string;staffId:string;staffCategory?:string;academicGroupIds?:string[];name:string;capableSubjectIds:string[];timetableEligibility?:any;workload?:any;weeklyLoad:number;dailyCapacity?:number;availableDays?:number[];weeklySubstitutions?:number;subjectAssignments?:any[];}
export interface CoverAttendance {status:string;source?:string;checkInTime?:string|null;checkOutTime?:string|null;expectedArrivalTime?:string|null;}
export interface CoverBooking {key:string;teacherId:string;startTime:string;endTime:string;}
export interface CoverContext {targets:CoverTarget[];teachers:CoverTeacher[];attendance:Record<string,CoverAttendance>;bookings:CoverBooking[];availability:any[];weekday:number;rules:any;requirePresent:boolean;enforceWorkloadLimits?:boolean;substitutionMatch?:'SUBJECT'|'COMPARTMENT';currentTime?:string;unavailable?:{teacherId:string;startTime:string;endTime:string;reason?:string}[];}
export const overlaps=(a:{startTime:string;endTime:string},b:{startTime:string;endTime:string})=>a.startTime<b.endTime&&b.startTime<a.endTime;
export function unavailableForLesson(attendance:CoverAttendance|undefined,target:{startTime:string;endTime?:string},requirePresent=false):boolean{
 if(!attendance||attendance.status==='NOT_MARKED')return requirePresent;
 if(attendance.checkOutTime&&(target.startTime>=attendance.checkOutTime||!!target.endTime&&target.endTime>attendance.checkOutTime))return true;
 if(['ABSENT','ON_LEAVE'].includes(attendance.status))return true;
 if(attendance.status==='LATE'&&['SELF_CHECKIN','SELF_CHECKOUT'].includes(attendance.source||'')&&!requirePresent)return false;
 if(['LATE','PERMISSION'].includes(attendance.status)){if(requirePresent&&!attendance.checkInTime)return true;const arrival=attendance.status==='PERMISSION'?attendance.expectedArrivalTime||attendance.checkInTime:attendance.checkInTime||attendance.expectedArrivalTime;return !arrival||target.startTime<arrival;}
 if(['PRESENT','ON_DUTY'].includes(attendance.status))return !!attendance.checkInTime&&target.startTime<attendance.checkInTime;
 return true;
}
function maxRun(bookings:{startTime:string;endTime:string}[]){let end='',run=0,max=0;for(const b of [...bookings].sort((a,b)=>a.startTime.localeCompare(b.startTime))){run=b.startTime===end?run+1:1;end=b.endTime;max=Math.max(max,run);}return max;}
const workloadReasons=new Set(['Minimum free period requirement','Daily workload limit','Weekly workload limit','Consecutive period limit']);
export function rankCandidates(c:CoverContext,target:CoverTarget,bookings=c.bookings,allowWorkloadOverride=false){
 const ranked:any[]=[],rejected:any[]=[];
 for(const teacher of c.teachers){const reasons:string[]=[];const policy=teacher.timetableEligibility||{},workload=teacher.workload||{};
  if(teacher.id===target.teacherId)reasons.push('Main teacher is unavailable');
  if(teacher.staffCategory==='ADMIN')reasons.push('Admin/accounts staff are excluded from substitution');
  if(policy.canSubstitute!==true)reasons.push('Not enabled for substitution');
  if(!allowedForClass(teacher,target.classId,{name:target.className,academicGroup:target.academicGroup}))reasons.push('Class is not allowed');
  const compartment=academicGroup({name:target.className,academicGroup:target.academicGroup}),sameCompartment=Array.isArray(policy.groupResponsibilities)?policy.groupResponsibilities.some((r:any)=>r.groupId===compartment):policy.academicGroups?.length?policy.academicGroups.includes(compartment):(teacher.academicGroupIds||[]).includes(compartment||'');
  if(c.substitutionMatch==='COMPARTMENT'&&!sameCompartment)reasons.push('Not assigned to this academic compartment');
  if(c.substitutionMatch!=='COMPARTMENT'&&target.subjectId){const reason=teachingExclusion(teacher,target.classId,{name:target.className,academicGroup:target.academicGroup},target.subjectId);if(reason)reasons.push(reason);}
  if(unavailableForLesson(c.attendance[teacher.id],{...target,startTime:target.startTime>(c.currentTime||'00:00')?target.startTime:(c.currentTime||'00:00')},c.requirePresent))reasons.push('Teacher has not arrived or is absent');
  if(target.sequence&&(workload.unavailablePeriods||[]).includes(target.sequence))reasons.push('Unavailable period');
  if(workload.availableDays?.length&&!workload.availableDays.includes(c.weekday))reasons.push('Unavailable weekday');
  if(c.unavailable?.some(a=>a.teacherId===teacher.id&&overlaps(a,target)))reasons.push('Approved leave or confirmed unavailable interval');
  if(c.availability.some(a=>a.teacherId===teacher.id&&a.weekday===c.weekday&&!a.isAvailable&&(a.periodSlotId===target.slotId||(a.startTime&&overlaps(a,target)))))reasons.push('Unavailable period');
  const own=bookings.filter(b=>b.teacherId===teacher.id&&b.key!==target.key);
  if(own.some(b=>overlaps(b,{...target,startTime:target.startTime>(c.currentTime||'00:00')?target.startTime:(c.currentTime||'00:00')})))reasons.push('Overlaps another lesson or cover');
  if(c.enforceWorkloadLimits!==false&&c.rules.teacherFreePeriodPriority==='MANDATORY'&&teacher.dailyCapacity!=null&&teacher.dailyCapacity-own.length-1<(workload.minimumFreePeriodsPerDay??c.rules.minimumTeacherFreePeriodsPerDay))reasons.push('Minimum free period requirement');
  if(c.enforceWorkloadLimits!==false&&own.length>=(workload.maxPeriodsPerDay??c.rules.maxTeacherPeriodsPerDay))reasons.push('Daily workload limit');
  const additional=own.filter(b=>b.key.startsWith('cover:')).length;
  if(c.enforceWorkloadLimits!==false&&teacher.weeklyLoad+additional>=(workload.maxPeriodsPerWeek??c.rules.maxTeacherPeriodsPerWeek))reasons.push('Weekly workload limit');
  if(c.enforceWorkloadLimits!==false&&c.rules.teacherConsecutivePriority==='MANDATORY'&&maxRun([...own,target])>(workload.maxConsecutivePeriods??c.rules.maxConsecutiveTeacherPeriods))reasons.push('Consecutive period limit');
  const overrideReasons=reasons.filter(reason=>workloadReasons.has(reason));
  const canOverrideWorkload=reasons.length>0&&reasons.every(reason=>workloadReasons.has(reason));
  if(reasons.length&&!(allowWorkloadOverride&&canOverrideWorkload)){rejected.push({teacherId:teacher.id,name:teacher.name,staffCategory:teacher.staffCategory||'TEACHING',canOverrideWorkload,reasons:[...new Set(reasons)]});continue;}
  const sameGroup=(policy.groupResponsibilities||[]).some((r:any)=>r.groupId===target.academicGroup&&(!target.subjectId||r.subjectIds?.includes(target.subjectId)));
  const qualification=(teacher.subjectAssignments||[]).filter((a:any)=>a.subjectId===target.subjectId&&a.classId===target.classId&&(!a.sectionId||a.sectionId===target.sectionId)).reduce((score:number,a:any)=>Math.max(score,a.assignmentRole==='PRIMARY'?20:a.assignmentRole==='BACKUP'?10:0),0);
  const preference=qualification+(policy.preferredClassIds?.includes(target.classId)?20:0)+(sameGroup?30:0);
  ranked.push({overrideReasons,teacherId:teacher.id,name:teacher.name,staffCategory:teacher.staffCategory||'TEACHING',priority:teacher.staffCategory==='NON_TEACHING'?2:1,score:100+preference-own.length*5-(teacher.weeklySubstitutions||0)*3-(maxRun([...own,target])>2?15:0),reason:c.substitutionMatch==='COMPARTMENT'?'Free in this period and assigned to the same compartment':preference?'Capable, available and preferred class':'Capable, available and within workload limits'});
 }
 ranked.sort((a,b)=>a.priority-b.priority||b.score-a.score||a.teacherId.localeCompare(b.teacherId));return{candidates:ranked,rejected};
}
export function planCover(c:CoverContext){
 const bookings=[...c.bookings],results:any[]=[],pending=[...c.targets];
 while(pending.length){pending.sort((a,b)=>rankCandidates(c,a,bookings).candidates.length-rankCandidates(c,b,bookings).candidates.length||a.startTime.localeCompare(b.startTime)||a.key.localeCompare(b.key));const target=pending.shift()!,ranked=rankCandidates(c,target,bookings),chosen=ranked.candidates[0];if(chosen)bookings.push({key:'cover:'+target.key,teacherId:chosen.teacherId,startTime:target.startTime,endTime:target.endTime});results.push({target,teacherId:chosen?.teacherId||null,candidates:ranked.candidates,rejected:ranked.rejected,status:chosen?'SCHEDULED':'NEEDS_SUBSTITUTE'});}
 return results;
}
