import {synchronizedTemplateSearch} from './synchronized-template-search';
export type Priority = 'MANDATORY'|'PREFERRED'|'OPTIONAL'|'DISABLED';
export const PRIORITIES: Priority[] = ['MANDATORY','PREFERRED','OPTIONAL','DISABLED'];
export const SLOT_TYPES = ['SUBJECT','ACTIVITY','ASSEMBLY','BREAK','SNACK','LUNCH','FREE_PLAY','MONTESSORI_WORK_CYCLE','LIBRARY','DISMISSAL'];
export const defaultRules = {
 allocationMode: 'AUTO' as 'AUTO'|'CUSTOM', classTeacherRequired:false, classTeacherFirstPeriodPriority:'PREFERRED' as Priority,
 classTeacherDailyPresencePriority:'PREFERRED' as Priority, maxTeacherPeriodsPerDay:5,
 maxTeacherPeriodsPerWeek:25,maxConsecutiveTeacherPeriods:3,minimumTeacherFreePeriodsPerDay:1,
 teacherConsecutivePriority:'PREFERRED' as Priority,teacherFreePeriodPriority:'PREFERRED' as Priority,
 avoidConsecutiveSameSubject:'PREFERRED' as Priority,spreadSubjectsAcrossWeek:'PREFERRED' as Priority,
 preferCoreSubjectsMorning:'PREFERRED' as Priority,preferActivitiesLater:'PREFERRED' as Priority,
 maxBacktrackingSteps:20000,slotRequiresTeacher:{SUBJECT:true,ACTIVITY:true,ASSEMBLY:true,BREAK:false,SNACK:false,LUNCH:false,FREE_PLAY:false,MONTESSORI_WORK_CYCLE:true,LIBRARY:true,DISMISSAL:false} as Record<string,boolean>,
};
export type Rules = typeof defaultRules;
export interface Slot {id:string;weekday:number;sequence:number;startTime:string;endTime:string;type:string;sectionId:string;classId:string;name?:string;}
export interface Requirement {sectionId:string;classId:string;subjectId:string;name:string;weeklyPeriods:number;maxPeriodsPerDay:number;allowConsecutive:boolean;preferredPeriods:number[];avoidPeriods:number[];teacherIds:string[];preferredTeacherIds:string[];core:boolean;activity:boolean;periodSlotId?:string;weekday?:number;}
export interface Entry {sectionId:string;classId:string;subjectId:string;teacherId:string;weekday:number;periodSlotId:string;}
export interface Context {rules:Rules;slots:Slot[];requirements:Requirement[];classTeachers:Record<string,string>;teachers:Record<string,any>;availability:any[];external:(Entry&{startTime:string;endTime:string})[];fixed:Entry[];}
const overlap=(a:{startTime:string;endTime:string},b:{startTime:string;endTime:string})=>a.startTime<b.endTime&&b.startTime<a.endTime;
const teaching=(s:Slot)=>s.type==='TEACHING'||s.type==='SUBJECT';
const weight=(p:Priority,n:number)=>p==='DISABLED'?0:p==='OPTIONAL'?n/4:n;
const lookupKey=(...parts:(string|number)[])=>JSON.stringify(parts);
const searchIndexes=new WeakMap<Context,{slots:Map<string,Slot>;requirements:Map<string,Requirement>}>();
const slotFor=(c:Context,e:Entry)=>searchIndexes.has(c)?searchIndexes.get(c)!.slots.get(lookupKey(e.sectionId,e.weekday,e.periodSlotId)):c.slots.find(s=>s.id===e.periodSlotId&&s.sectionId===e.sectionId&&s.weekday===e.weekday);
const required=(c:Context,e:Entry)=>searchIndexes.has(c)?searchIndexes.get(c)!.requirements.get(lookupKey(e.sectionId,e.subjectId)):c.requirements.find(r=>r.sectionId===e.sectionId&&r.subjectId===e.subjectId);
const teacherSlots=(c:Context,e:Entry,entries:Entry[])=>[...entries.filter(x=>x.teacherId===e.teacherId&&x.weekday===e.weekday).map(x=>slotFor(c,x)).filter(Boolean),...c.external.filter(x=>x.teacherId===e.teacherId&&x.weekday===e.weekday)] as Slot[];
function runLength(slots:{startTime:string;endTime:string}[]){const ordered=[...slots].sort((a,b)=>a.startTime.localeCompare(b.startTime));let run=0,max=0,last='';for(const s of ordered){run=last===s.startTime?run+1:1;max=Math.max(max,run);last=s.endTime;}return max;}
export function hardErrors(c:Context,e:Entry,entries:Entry[]):string[]{
 const errors:string[]=[],slot=slotFor(c,e),r=required(c,e),t=c.teachers[e.teacherId];
 if(!slot)return ['BREAK_OR_INVALID_SLOT'];
 const duty=!!r?.periodSlotId;
 if(!teaching(slot)&&!duty)return ['BREAK_OR_INVALID_SLOT'];
 if(duty&&(r!.periodSlotId!==slot.id||r!.weekday!==e.weekday||!c.rules.slotRequiresTeacher[slot.type]))errors.push('BREAK_OR_INVALID_SLOT');
 if(!r||!r.teacherIds.includes(e.teacherId)||!t)errors.push('SUBJECT_ELIGIBILITY');
 if(slot.classId!==e.classId)errors.push('SECTION_CONFLICT');
 if(entries.some(x=>x.sectionId===e.sectionId&&x.weekday===e.weekday&&slotFor(c,x)&&overlap(slot,slotFor(c,x)!)))errors.push('SECTION_CONFLICT');
 if(teacherSlots(c,e,entries).some(x=>overlap(slot,x)))errors.push('TEACHER_CONFLICT');
 if(c.availability.some(a=>a.teacherId===e.teacherId&&a.weekday===e.weekday&&!a.isAvailable&&(a.periodSlotId===slot.id||(a.startTime&&overlap(slot,a)))))errors.push('AVAILABILITY');
 if((t?.unavailablePeriods||[]).includes(slot.sequence)||((t?.availableDays||[]).length&&!t.availableDays.includes(e.weekday)))errors.push('AVAILABILITY');
 if(c.availability.some(a=>a.teacherId===e.teacherId&&a.weekday===e.weekday&&!a.isAvailable&&c.slots.some(s=>s.id===a.periodSlotId&&s.weekday===e.weekday&&overlap(slot,s))))errors.push('AVAILABILITY');
 const daily=teacherSlots(c,e,entries),weekly=entries.filter(x=>x.teacherId===e.teacherId).length+c.external.filter(x=>x.teacherId===e.teacherId).length;
 if(daily.length>=(t?.maxPeriodsPerDay??c.rules.maxTeacherPeriodsPerDay)||weekly>=(t?.maxPeriodsPerWeek??c.rules.maxTeacherPeriodsPerWeek))errors.push('WORKLOAD');
 if(c.rules.teacherConsecutivePriority==='MANDATORY'&&runLength([...daily,slot])>(t?.maxConsecutivePeriods??c.rules.maxConsecutiveTeacherPeriods))errors.push('WORKLOAD');
 if(c.rules.teacherFreePeriodPriority==='MANDATORY'){const daySlots=c.slots.filter(s=>s.weekday===e.weekday&&teaching(s));const unique=new Set(daySlots.map(s=>s.startTime+'-'+s.endTime)).size;if(unique-daily.length-1<(t?.minimumFreePeriodsPerDay??c.rules.minimumTeacherFreePeriodsPerDay))errors.push('WORKLOAD');}
 const subjectDay=entries.filter(x=>x.sectionId===e.sectionId&&x.subjectId===e.subjectId&&x.weekday===e.weekday);
 if(r&&subjectDay.length>=r.maxPeriodsPerDay)errors.push('SUBJECT_DAILY_LIMIT');
 if(r?.avoidPeriods.includes(slot.sequence))errors.push('AVOID_PERIOD');
 if(r&&!r.allowConsecutive&&c.rules.avoidConsecutiveSameSubject==='MANDATORY'&&subjectDay.some(x=>{const s=slotFor(c,x)!;return s&&(s.endTime===slot.startTime||slot.endTime===s.startTime);}))errors.push('SUBJECT_CONSECUTIVE');
 const normalSlots=c.slots.filter(s=>s.sectionId===e.sectionId&&s.weekday===e.weekday&&teaching(s)).sort((a,b)=>a.sequence-b.sequence);
 const early=normalSlots.findIndex(s=>s.id===slot.id)<Math.ceil(normalSlots.length/2);
 if(!duty&&r?.core&&c.rules.preferCoreSubjectsMorning==='MANDATORY'&&!early)errors.push('CORE_PERIOD_PREFERENCE');
 if(!duty&&r?.activity&&c.rules.preferActivitiesLater==='MANDATORY'&&early)errors.push('ACTIVITY_PERIOD_PREFERENCE');
 if(!duty&&r&&c.rules.spreadSubjectsAcrossWeek==='MANDATORY'){const days=new Set(c.slots.filter(s=>s.sectionId===e.sectionId&&teaching(s)).map(s=>s.weekday)).size;if(subjectDay.length>=Math.ceil(r.weeklyPeriods/days))errors.push('SUBJECT_DISTRIBUTION');}
 const first=c.slots.filter(s=>s.sectionId===e.sectionId&&s.weekday===e.weekday&&teaching(s)).sort((a,b)=>a.sequence-b.sequence)[0];
 if(!duty&&c.rules.classTeacherFirstPeriodPriority==='MANDATORY'&&first?.id===slot.id&&c.classTeachers[e.sectionId]!==e.teacherId)errors.push('CLASS_TEACHER_FIRST_PERIOD');
 return [...new Set(errors)];
}
export function score(c:Context,e:Entry,entries:Entry[]):number {
 const slot=slotFor(c,e)!,r=required(c,e)!;let score=100;
 const day=entries.filter(x=>x.sectionId===e.sectionId&&x.weekday===e.weekday),same=day.filter(x=>x.subjectId===e.subjectId);
 const sectionSlots=c.slots.filter(s=>s.sectionId===e.sectionId&&s.weekday===e.weekday&&teaching(s)).sort((a,b)=>a.sequence-b.sequence);
 const early=sectionSlots.findIndex(s=>s.id===slot.id)<Math.ceil(sectionSlots.length/2),ct=c.classTeachers[e.sectionId];
 if(ct===e.teacherId&&sectionSlots[0]?.id===slot.id)score+=weight(c.rules.classTeacherFirstPeriodPriority,25);
 if(ct===e.teacherId&&!day.some(x=>x.teacherId===ct))score+=weight(c.rules.classTeacherDailyPresencePriority,20);
 if(r.preferredTeacherIds.includes(e.teacherId))score+=20;
 if(r.preferredPeriods.includes(slot.sequence)||(c.teachers[e.teacherId]?.preferredPeriods||[]).includes(slot.sequence))score+=15;
 if(!r.periodSlotId&&r.core)score+=weight(c.rules.preferCoreSubjectsMorning,early?15:-15);
 if(!r.periodSlotId&&r.activity)score+=weight(c.rules.preferActivitiesLater,early?-10:15);
 score+=weight(c.rules.spreadSubjectsAcrossWeek,same.length?-20*same.length:20);
 if(!r.allowConsecutive&&same.some(x=>{const s=slotFor(c,x)!;return s.endTime===slot.startTime||slot.endTime===s.startTime;}))score-=weight(c.rules.avoidConsecutiveSameSubject,20);
 const daily=teacherSlots(c,e,entries),t=c.teachers[e.teacherId];
 if(runLength([...daily,slot])>(t?.maxConsecutivePeriods??c.rules.maxConsecutiveTeacherPeriods))score-=weight(c.rules.teacherConsecutivePriority,20);
 score-=weight(c.rules.teacherFreePeriodPriority,daily.length*5);
 return score;
}
export function validate(c:Context,entries:Entry[]){
 const errors:any[]=[],warnings:any[]=[];const summary={sectionsChecked:new Set(c.slots.map(s=>s.sectionId)).size,teachersChecked:new Set(entries.map(e=>e.teacherId)).size,teacherConflicts:0,sectionConflicts:0,availabilityConflicts:0,workloadConflicts:0,subjectRequirementIssues:0,preferredRuleWarnings:0};
 entries.forEach((e,i)=>{for(const code of hardErrors(c,e,entries.filter((_,j)=>i!==j))){errors.push({code,...e});if(code==='TEACHER_CONFLICT')summary.teacherConflicts++;if(code==='SECTION_CONFLICT')summary.sectionConflicts++;if(code==='AVAILABILITY')summary.availabilityConflicts++;if(code==='WORKLOAD')summary.workloadConflicts++;}});
 for(const r of c.requirements){const actual=entries.filter(e=>e.sectionId===r.sectionId&&e.subjectId===r.subjectId).length;if(actual!==r.weeklyPeriods){errors.push({code:'WEEKLY_REQUIREMENT',sectionId:r.sectionId,subject:r.name,required:r.weeklyPeriods,actual});summary.subjectRequirementIssues++;}}
 for(const sectionId of new Set(c.slots.map(s=>s.sectionId))){const ct=c.classTeachers[sectionId];if(c.rules.classTeacherRequired&&!ct)errors.push({code:'CLASS_TEACHER_REQUIRED',sectionId});for(const weekday of new Set(c.slots.filter(s=>s.sectionId===sectionId&&teaching(s)).map(s=>s.weekday))){const first=c.slots.filter(s=>s.sectionId===sectionId&&s.weekday===weekday&&teaching(s)).sort((a,b)=>a.sequence-b.sequence)[0];for(const [priority,code,ok] of [[c.rules.classTeacherFirstPeriodPriority,'CLASS_TEACHER_FIRST_PERIOD',entries.some(e=>e.sectionId===sectionId&&e.weekday===weekday&&e.periodSlotId===first?.id&&e.teacherId===ct)],[c.rules.classTeacherDailyPresencePriority,'CLASS_TEACHER_DAILY_PRESENCE',entries.some(e=>e.sectionId===sectionId&&e.weekday===weekday&&e.teacherId===ct)]] as const){if(priority==='MANDATORY'&&!ok)errors.push({code,sectionId,weekday});else if((priority==='PREFERRED'||priority==='OPTIONAL')&&!ok)warnings.push({code,sectionId,weekday});}}}
 for(const r of c.requirements.filter(r=>!r.periodSlotId)){
  const days=[...new Set(c.slots.filter(s=>s.sectionId===r.sectionId&&teaching(s)).map(s=>s.weekday))];
  const counts=days.map(d=>entries.filter(e=>e.sectionId===r.sectionId&&e.subjectId===r.subjectId&&e.weekday===d).length);
  if(Math.max(...counts)-Math.min(...counts)>1){const issue={code:'SUBJECT_DISTRIBUTION',sectionId:r.sectionId,subject:r.name};if(c.rules.spreadSubjectsAcrossWeek==='MANDATORY')errors.push(issue);else if(c.rules.spreadSubjectsAcrossWeek!=='DISABLED')warnings.push(issue);}
 }
 for(const e of entries){const others=entries.filter(x=>x!==e);if(score(c,e,others)<100)warnings.push({code:'PREFERENCE_NOT_MET',...e});}
 summary.preferredRuleWarnings=warnings.length;return{valid:!errors.length,summary,errors,warnings};
}
export function feasibility(c:Context){
 const periods:any[]=[];let peak=0,shortage=0;
 const groups=new Map<string,Slot[]>();for(const slot of c.slots.filter(s=>teaching(s)||c.rules.slotRequiresTeacher[s.type])){const key=slot.weekday+':'+slot.startTime+':'+slot.endTime;groups.set(key,[...(groups.get(key)||[]),slot]);}
 for(const slots of groups.values()){
  // Only sections whose required load fills every teaching slot must be staffed at every period.
  const demanding=slots.filter(s=>!teaching(s)||c.requirements.filter(r=>r.sectionId===s.sectionId&&!r.periodSlotId).reduce((n,r)=>n+r.weeklyPeriods,0)>=c.slots.filter(x=>x.sectionId===s.sectionId&&teaching(x)).length||c.fixed.some(e=>e.sectionId===s.sectionId&&e.weekday===s.weekday&&e.periodSlotId===s.id));
  const candidates=demanding.map(s=>[...new Set(c.requirements.filter(r=>r.sectionId===s.sectionId&&(!r.periodSlotId||(r.periodSlotId===s.id&&r.weekday===s.weekday))).flatMap(r=>r.teacherIds))].filter(teacherId=>c.requirements.some(r=>r.sectionId===s.sectionId&&r.teacherIds.includes(teacherId)&&!hardErrors(c,{sectionId:s.sectionId,classId:s.classId,weekday:s.weekday,periodSlotId:s.id,subjectId:r.subjectId,teacherId},[]).length)));
  const matched=new Map<string,number>();const match=(i:number,seen:Set<string>):boolean=>{for(const id of candidates[i]){if(seen.has(id))continue;seen.add(id);if(!matched.has(id)||match(matched.get(id)!,seen)){matched.set(id,i);return true;}}return false;};
  let count=0;for(let i=0;i<demanding.length;i++)if(match(i,new Set()))count++;
  peak=Math.max(peak,demanding.length);const missing=demanding.length-count;shortage=Math.max(shortage,missing);
  if(missing)periods.push({weekday:slots[0].weekday,startTime:slots[0].startTime,endTime:slots[0].endTime,sectionsRequiringTeacher:demanding.length,eligibleAvailableTeachers:count,shortage:missing});
 }
 return{status:shortage?'INSUFFICIENT_STAFF':'FEASIBLE',availableTeachers:Object.keys(c.teachers).length,peakTeachersRequired:peak,minimumAdditionalTeachersRequired:shortage,periods,suggestions:shortage?['Add at least '+shortage+' eligible teacher(s).','Increase teacher availability or reduce simultaneous teacher-led sessions.','Configure Montessori work-cycle or activity slots.']:[]};
}
export function subjectCapacity(c:Context,r:Requirement){
 const slots=c.slots.filter(s=>s.sectionId===r.sectionId&&(r.periodSlotId?s.id===r.periodSlotId&&s.weekday===r.weekday:teaching(s)));
 const usable=new Set<string>();let teacherCapacity=0;
 for(const teacherId of r.teacherIds){const t=c.teachers[teacherId]||{},valid=slots.filter(s=>!hardErrors(c,{sectionId:r.sectionId,classId:r.classId,subjectId:r.subjectId,teacherId,weekday:s.weekday,periodSlotId:s.id},[]).length);valid.forEach(s=>usable.add(s.weekday+':'+s.id));let perDay=0;
  for(const day of new Set(valid.map(s=>s.weekday))){const booked=c.external.filter(e=>e.teacherId===teacherId&&e.weekday===day).length;perDay+=Math.min(valid.filter(s=>s.weekday===day).length,Math.max(0,(t.maxPeriodsPerDay??c.rules.maxTeacherPeriodsPerDay)-booked));}
  const bookedWeek=c.external.filter(e=>e.teacherId===teacherId).length;teacherCapacity+=Math.min(perDay,Math.max(0,(t.maxPeriodsPerWeek??c.rules.maxTeacherPeriodsPerWeek)-bookedWeek));
 }
 const days=new Set(slots.map(s=>s.weekday)).size;return Math.min(usable.size,teacherCapacity,r.maxPeriodsPerDay*days);
}
export function generate(c:Context){
 // Keep indexes local to this run so later configuration edits cannot reuse stale data.
 c={...c};
 searchIndexes.set(c,{slots:new Map(c.slots.map(s=>[lookupKey(s.sectionId,s.weekday,s.id),s])),requirements:new Map(c.requirements.map(r=>[lookupKey(r.sectionId,r.subjectId),r]))});
 const entries=[...c.fixed],staffing=feasibility(c);let attempts=0,lastReason='No valid placement satisfies all mandatory rules.';
 for(const r of c.requirements){const capacity=subjectCapacity(c,r);if(capacity<r.weeklyPeriods)return{success:false,entries:[],attempts,staffing,reason:r.name+' requires '+r.weeklyPeriods+' weekly periods, but eligible teachers have only '+capacity+' available periods.',suggestions:['Assign another eligible '+r.name+' teacher.','Increase teacher availability or workload limits.','Reduce the weekly subject requirement.']};}
 // Match all required lessons to eligible teachers' remaining weekly capacity.
 // Individual subject checks miss shortages shared across multiple subjects/sections.
 const teacherLoads=new Map<string,number[]>();
 const capacities=new Map(Object.keys(c.teachers).map(id=>[id,Math.max(0,(c.teachers[id].maxPeriodsPerWeek??c.rules.maxTeacherPeriodsPerWeek)-c.external.filter(e=>e.teacherId===id).length)]));
 const lessons:Requirement[]=[];let matched=0;
 const assign=(lesson:number,seen:Set<string>):boolean=>{
  for(const id of lessons[lesson].teacherIds){if(seen.has(id)||!capacities.has(id))continue;seen.add(id);const load=teacherLoads.get(id)||[];
   if(load.length<capacities.get(id)!){load.push(lesson);teacherLoads.set(id,load);return true;}
   for(let i=0;i<load.length;i++)if(assign(load[i],seen)){load[i]=lesson;return true;}
  }return false;
 };
 for(const r of c.requirements)for(let n=0;n<r.weeklyPeriods;n++){lessons.push(r);if(assign(lessons.length-1,new Set()))matched++;}
 if(matched<lessons.length)return{success:false,entries:[],attempts,staffing,reason:'The selected sections require '+lessons.length+' teacher-led periods per week, but eligible teachers can cover at most '+matched+' under current weekly workload limits ('+(lessons.length-matched)+' periods short).',suggestions:['Add eligible teachers or expand subject/class eligibility.','Review teacher weekly workload limits.','Reduce teacher-led periods, including reserved activities requiring supervision.']};
 if(staffing.status==='INSUFFICIENT_STAFF')return{success:false,entries:[],attempts,staffing,reason:'Insufficient eligible and available teachers for simultaneous sections.',suggestions:staffing.suggestions};
 for(let i=0;i<entries.length;i++)if(hardErrors(c,entries[i],entries.filter((_,j)=>i!==j)).length)return{success:false,entries:[],attempts,staffing,reason:'A fixed entry violates mandatory rules.',suggestions:['Correct fixed entries or teacher availability.']};
 const remaining=c.requirements.map(r=>r.weeklyPeriods-entries.filter(e=>e.sectionId===r.sectionId&&e.subjectId===r.subjectId).length);
 if(remaining.some(n=>n<0))return{success:false,entries:[],attempts,staffing,reason:'Fixed entries exceed a weekly subject requirement.',suggestions:['Reduce fixed entries.']};
 // Static eligibility and availability never improve as lessons are added.
 const candidates=c.requirements.map(r=>c.slots.filter(s=>s.sectionId===r.sectionId&&(r.periodSlotId?s.id===r.periodSlotId&&s.weekday===r.weekday:teaching(s))).flatMap(slot=>r.teacherIds.map(teacherId=>({sectionId:r.sectionId,classId:r.classId,subjectId:r.subjectId,teacherId,weekday:slot.weekday,periodSlotId:slot.id}))).filter(e=>!hardErrors(c,e,[]).length));
 // For shared period boundaries, match teachers for simultaneous sections.
 // Subject swaps preserve weekly counts and avoid repeatedly exploring
 // equivalent lesson permutations in the general backtracking search.
 const templateMode=c.rules.maxTeacherPeriodsPerWeek>=c.slots.length+c.external.length&&c.rules.maxTeacherPeriodsPerDay>=c.slots.length+c.external.length&&c.rules.allocationMode==='AUTO'&&c.rules.classTeacherFirstPeriodPriority==='DISABLED'&&c.rules.classTeacherDailyPresencePriority==='DISABLED'&&c.rules.teacherConsecutivePriority==='DISABLED'&&c.rules.teacherFreePeriodPriority==='DISABLED'&&!c.availability.length&&!Object.values(c.teachers).some(t=>Object.keys(t).length)&&c.requirements.every(r=>!r.periodSlotId&&!r.avoidPeriods.length&&r.allowConsecutive)&&!['spreadSubjectsAcrossWeek','preferCoreSubjectsMorning','preferActivitiesLater'].some(key=>(c.rules as any)[key]==='MANDATORY')&&[...new Set(c.slots.map(s=>s.sectionId))].every(id=>c.requirements.filter(r=>r.sectionId===id).reduce((n,r)=>n+r.weeklyPeriods,0)===c.slots.filter(s=>s.sectionId===id&&teaching(s)).length);
 if(templateMode){const synchronized=synchronizedTemplateSearch(c,c.rules.maxBacktrackingSteps);if(synchronized)attempts=synchronized.attempts;if(synchronized?.entries.length){const checked=validate(c,synchronized.entries);if(checked.valid)return{success:true,entries:synchronized.entries,attempts:synchronized.attempts,staffing,validation:checked};}}
 function search():boolean{
  if(++attempts>c.rules.maxBacktrackingSteps)return false;
  if(remaining.every(n=>n===0))return validate(c,entries).valid;
  let index=-1,best:Entry[]=[];
  for(let i=0;i<c.requirements.length;i++){if(!remaining[i])continue;const r=c.requirements[i],choices:Entry[]=[];
   for(const e of candidates[i])if(!hardErrors(c,e,entries).length)choices.push(e);
   const distinctSlots=new Set(choices.map(e=>lookupKey(e.weekday,e.periodSlotId))).size;
   if(distinctSlots<remaining[i]){lastReason=r.name+' requires '+r.weeklyPeriods+' weekly periods, but only '+distinctSlots+' valid placements remain for '+remaining[i]+' outstanding periods.';return false;}
   if(index<0||choices.length/remaining[i]<best.length/remaining[index]){index=i;best=choices;}
  }
  const scores=new Map(best.map(e=>[e,score(c,e,entries)]));
  best.sort((a,b)=>scores.get(b)!-scores.get(a)!||a.weekday-b.weekday||slotFor(c,a)!.sequence-slotFor(c,b)!.sequence||a.teacherId.localeCompare(b.teacherId));
  for(const entry of best){entries.push(entry);remaining[index]--;if(search())return true;remaining[index]++;entries.pop();if(attempts>c.rules.maxBacktrackingSteps)break;}
  return false;
 }

 if(!search())return{success:false,entries:[],attempts,staffing,reason:attempts>c.rules.maxBacktrackingSteps?'Search limit reached; no valid timetable was found within '+c.rules.maxBacktrackingSteps+' steps.':lastReason,suggestions:templateMode?['Review subject responsibilities and shared teachers for the selected classes.','Check active period templates and published lessons outside this batch.']:['Assign another eligible subject teacher.','Increase teacher availability or workload capacity.','Reduce weekly requirements or relax preferred rules.']};
 return{success:true,entries,attempts,staffing,validation:validate(c,entries)};
}
