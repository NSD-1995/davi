import {teachingExclusion} from '../teaching-responsibilities';
import {allowedForClass} from './teacher-eligibility';
export interface CoverTarget {key:string;entryId?:string;planId:string;slotId:string;teacherId:string;classId:string;sectionId:string;subjectId:string|null;subjectName:string;className:string;academicGroup?:string|null;sectionName:string;startTime:string;endTime:string;sequence?:number;}
export interface CoverTeacher {id:string;staffId:string;name:string;capableSubjectIds:string[];timetableEligibility?:any;workload?:any;weeklyLoad:number;dailyCapacity?:number;availableDays?:number[];}
export interface CoverAttendance {status:string;checkInTime?:string|null;expectedArrivalTime?:string|null;}
export interface CoverBooking {key:string;teacherId:string;startTime:string;endTime:string;}
export interface CoverContext {targets:CoverTarget[];teachers:CoverTeacher[];attendance:Record<string,CoverAttendance>;bookings:CoverBooking[];availability:any[];weekday:number;rules:any;requirePresent:boolean;currentTime?:string;}
export const overlaps=(a:{startTime:string;endTime:string},b:{startTime:string;endTime:string})=>a.startTime<b.endTime&&b.startTime<a.endTime;
export function unavailableForLesson(attendance:CoverAttendance|undefined,target:{startTime:string},requirePresent=false):boolean{
 if(!attendance)return requirePresent;
 if(['ABSENT','ON_LEAVE'].includes(attendance.status))return true;
 if(['LATE','PERMISSION'].includes(attendance.status)){if(requirePresent&&!attendance.checkInTime)return true;const arrival=attendance.status==='PERMISSION'?attendance.expectedArrivalTime||attendance.checkInTime:attendance.checkInTime||attendance.expectedArrivalTime;return !arrival||target.startTime<arrival;}
 if(attendance.status==='PRESENT')return !!attendance.checkInTime&&target.startTime<attendance.checkInTime;
 return true;
}
function maxRun(bookings:{startTime:string;endTime:string}[]){let end='',run=0,max=0;for(const b of [...bookings].sort((a,b)=>a.startTime.localeCompare(b.startTime))){run=b.startTime===end?run+1:1;end=b.endTime;max=Math.max(max,run);}return max;}
export function rankCandidates(c:CoverContext,target:CoverTarget,bookings=c.bookings){
 const ranked:any[]=[],rejected:any[]=[];
 for(const teacher of c.teachers){const reasons:string[]=[];const policy=teacher.timetableEligibility||{},workload=teacher.workload||{};
  if(teacher.id===target.teacherId)reasons.push('Main teacher is unavailable');
  if(policy.canSubstitute!==true)reasons.push('Not enabled for substitution');
  if(!allowedForClass(teacher,target.classId,{name:target.className,academicGroup:target.academicGroup}))reasons.push('Class is not allowed');
  if(target.subjectId){const reason=teachingExclusion(teacher,target.classId,{name:target.className,academicGroup:target.academicGroup},target.subjectId);if(reason)reasons.push(reason);}
  if(unavailableForLesson(c.attendance[teacher.id],{startTime:target.startTime>(c.currentTime||'00:00')?target.startTime:(c.currentTime||'00:00')},c.requirePresent))reasons.push('Teacher has not arrived or is absent');
  if(target.sequence&&(workload.unavailablePeriods||[]).includes(target.sequence))reasons.push('Unavailable period');
  if(workload.availableDays?.length&&!workload.availableDays.includes(c.weekday))reasons.push('Unavailable weekday');
  if(c.availability.some(a=>a.teacherId===teacher.id&&a.weekday===c.weekday&&!a.isAvailable&&(a.periodSlotId===target.slotId||(a.startTime&&overlaps(a,target)))))reasons.push('Unavailable period');
  const own=bookings.filter(b=>b.teacherId===teacher.id&&b.key!==target.key);
  if(own.some(b=>overlaps(b,{...target,startTime:target.startTime>(c.currentTime||'00:00')?target.startTime:(c.currentTime||'00:00')})))reasons.push('Overlaps another lesson or cover');
  if(c.rules.teacherFreePeriodPriority==='MANDATORY'&&teacher.dailyCapacity!=null&&teacher.dailyCapacity-own.length-1<(workload.minimumFreePeriodsPerDay??c.rules.minimumTeacherFreePeriodsPerDay))reasons.push('Minimum free period requirement');
  if(own.length>=(workload.maxPeriodsPerDay??c.rules.maxTeacherPeriodsPerDay))reasons.push('Daily workload limit');
  const additional=own.filter(b=>b.key.startsWith('cover:')).length;
  if(teacher.weeklyLoad+additional>=(workload.maxPeriodsPerWeek??c.rules.maxTeacherPeriodsPerWeek))reasons.push('Weekly workload limit');
  if(c.rules.teacherConsecutivePriority==='MANDATORY'&&maxRun([...own,target])>(workload.maxConsecutivePeriods??c.rules.maxConsecutiveTeacherPeriods))reasons.push('Consecutive period limit');
  if(reasons.length){rejected.push({teacherId:teacher.id,name:teacher.name,reasons:[...new Set(reasons)]});continue;}
  const preference=policy.preferredClassIds?.includes(target.classId)?20:0;
  ranked.push({teacherId:teacher.id,name:teacher.name,score:100+preference-own.length*5-(maxRun([...own,target])>2?15:0),reason:preference?'Capable, available and preferred class':'Capable, available and within workload limits'});
 }
 ranked.sort((a,b)=>b.score-a.score||a.teacherId.localeCompare(b.teacherId));return{candidates:ranked,rejected};
}
export function planCover(c:CoverContext){
 const bookings=[...c.bookings],results:any[]=[],pending=[...c.targets];
 while(pending.length){pending.sort((a,b)=>rankCandidates(c,a,bookings).candidates.length-rankCandidates(c,b,bookings).candidates.length||a.startTime.localeCompare(b.startTime)||a.key.localeCompare(b.key));const target=pending.shift()!,ranked=rankCandidates(c,target,bookings),chosen=ranked.candidates[0];if(chosen)bookings.push({key:'cover:'+target.key,teacherId:chosen.teacherId,startTime:target.startTime,endTime:target.endTime});results.push({target,teacherId:chosen?.teacherId||null,candidates:ranked.candidates,rejected:ranked.rejected,status:chosen?'SCHEDULED':'NEEDS_SUBSTITUTE'});}
 return results;
}
