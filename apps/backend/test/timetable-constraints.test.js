const test=require('node:test'),assert=require('node:assert/strict');
const {defaultRules,hardErrors,generate,validate,feasibility}=require('../dist/timetable/constraint-engine');
function context(sections=1,teachers=sections,periods=2,days=[1,2]){
 const c={rules:{...defaultRules,slotRequiresTeacher:{...defaultRules.slotRequiresTeacher}},slots:[],requirements:[],classTeachers:{},teachers:{},availability:[],external:[],fixed:[]};
 for(let i=0;i<teachers;i++)c.teachers['t'+i]={};
 for(let i=0;i<sections;i++){c.classTeachers['s'+i]='t'+Math.min(i,teachers-1);for(const weekday of days)for(let p=0;p<periods;p++)c.slots.push({id:'p'+p,weekday,sequence:p+1,startTime:String(9+p).padStart(2,'0')+':00',endTime:String(10+p).padStart(2,'0')+':00',type:'TEACHING',classId:'c'+i,sectionId:'s'+i});c.requirements.push({sectionId:'s'+i,classId:'c'+i,subjectId:'subject'+i,name:'Mathematics '+i,weeklyPeriods:periods*days.length,maxPeriodsPerDay:periods,allowConsecutive:true,preferredPeriods:[],avoidPeriods:[],teacherIds:['t'+Math.min(i,teachers-1)],preferredTeacherIds:[],core:true,activity:false});}
 return c;
}
const entry=(sectionId='s0',teacherId='t0',subjectId='subject0',periodSlotId='p0',weekday=1)=>({sectionId,classId:'c'+sectionId.slice(1),teacherId,subjectId,periodSlotId,weekday});
test('teacher cannot teach two sections in an overlapping period',()=>{const c=context(2);c.requirements[1].teacherIds=['t0'];assert.ok(hardErrors(c,entry('s1','t0','subject1'),[entry()]).includes('TEACHER_CONFLICT'));});
test('section cannot receive two subjects in one period',()=>{const c=context();c.requirements.push({...c.requirements[0],subjectId:'art',teacherIds:['t1']});c.teachers.t1={};assert.ok(hardErrors(c,entry('s0','t1','art'),[entry()]).includes('SECTION_CONFLICT'));});
test('unavailable teacher is excluded',()=>{const c=context();c.availability=[{teacherId:'t0',weekday:1,periodSlotId:'p0',isAvailable:false}];assert.ok(hardErrors(c,entry(),[]).includes('AVAILABILITY'));assert.equal(generate(c).success,false);});
test('teacher must be allocated to the subject',()=>{const c=context();c.teachers.t1={};assert.ok(hardErrors(c,entry('s0','t1'),[]).includes('SUBJECT_ELIGIBILITY'));});
test('class teacher first period is preferred by default and used where possible',()=>{const c=context(1,2,2,[1]);c.requirements[0].weeklyPeriods=1;c.requirements[0].teacherIds=['t0','t1'];const result=generate(c);assert.equal(result.success,true);assert.equal(result.entries[0].periodSlotId,'p0');assert.equal(result.entries[0].teacherId,'t0');});
test('class teacher preference is relaxed when the class teacher is unavailable',()=>{const c=context(1,2,2,[1]);c.requirements[0].teacherIds=['t0','t1'];c.availability=[{teacherId:'t0',weekday:1,periodSlotId:'p0',isAvailable:false}];const result=generate(c);assert.equal(result.success,true);assert.equal(result.entries.find(e=>e.periodSlotId==='p0').teacherId,'t1');});
test('maximum teacher daily and weekly workload is mandatory',()=>{for(const field of ['maxPeriodsPerDay','maxPeriodsPerWeek']){const c=context();c.teachers.t0={[field]:1};assert.equal(generate(c).success,false);assert.ok(hardErrors(c,entry('s0','t0','subject0','p1'),[entry()]).includes('WORKLOAD'));}});
test('mandatory teacher consecutive rule is enforced',()=>{const c=context(1,1,3,[1]);c.rules.teacherConsecutivePriority='MANDATORY';c.rules.maxConsecutiveTeacherPeriods=1;assert.ok(hardErrors(c,entry('s0','t0','subject0','p1'),[entry()]).includes('WORKLOAD'));assert.equal(generate(c).success,false);});
test('missing weekly subject periods fails full validation',()=>{const c=context();const result=validate(c,[entry()]);assert.equal(result.valid,false);assert.equal(result.summary.subjectRequirementIssues,1);});
test('subject periods are spread across working days',()=>{const c=context(1,1,2,[1,2,3,4,5]);c.requirements[0].weeklyPeriods=5;const result=generate(c);assert.equal(result.success,true);assert.equal(new Set(result.entries.map(e=>e.weekday)).size,5);});
test('break slots cannot receive normal subjects',()=>{const c=context();c.slots[0].type='BREAK';assert.ok(hardErrors(c,entry(),[]).includes('BREAK_OR_INVALID_SLOT'));});
test('staffing detects insufficient simultaneous eligible teachers',()=>{const c=context(2,1);const result=feasibility(c);assert.equal(result.status,'INSUFFICIENT_STAFF');assert.equal(result.minimumAdditionalTeachersRequired,1);assert.equal(generate(c).success,false);});
test('generates a valid deterministic eight-section eight-teacher timetable',()=>{const c=context(8,8,5,[1,2,3,4,5]);const a=generate(c),b=generate(c);assert.equal(a.success,true);assert.equal(a.entries.length,200);assert.equal(a.validation.valid,true);assert.equal(a.validation.summary.teacherConflicts,0);assert.deepEqual(a.entries,b.entries);});
test('impossible generation returns an explanation and no partial entries',()=>{const c=context();c.requirements[0].weeklyPeriods=10;const result=generate(c);assert.equal(result.success,false);assert.deepEqual(result.entries,[]);assert.match(result.reason,/requires 10/);assert.ok(result.suggestions.length);});
test('fixed entries are placed first and invalid fixed entries are rejected',()=>{const c=context();c.fixed=[entry('s0','t0','subject0','p1',2)];const result=generate(c);assert.equal(result.success,true);assert.deepEqual(result.entries[0],c.fixed[0]);c.fixed=[entry(),entry()];assert.equal(generate(c).success,false);});
test('bounded backtracking reports its search limit',()=>{const c=context();c.rules.maxBacktrackingSteps=1;const result=generate(c);assert.equal(result.success,false);assert.match(result.reason,/Search limit/);});
test('shared weekly teacher shortage fails before backtracking',()=>{
 const c=context(2,2,2,[1,2]);c.requirements.forEach(r=>r.teacherIds=['t0','t1']);c.rules.maxTeacherPeriodsPerWeek=3;
 const result=generate(c);assert.equal(result.success,false);assert.equal(result.attempts,0);assert.match(result.reason,/require 8.*at most 6.*2 periods short/);assert.deepEqual(result.entries,[]);
});
test('weekly capacity matching can reroute a flexible subject to another teacher',()=>{
 const c=context(2,2,1,[1]);c.requirements[0].teacherIds=['t0','t1'];c.requirements[1].teacherIds=['t0'];c.rules.maxTeacherPeriodsPerWeek=1;
 assert.equal(generate(c).success,true);
});
test('generation rebuilds lookups after slots and eligibility change',()=>{
 const c=context(1,2,2,[1]);assert.equal(generate(c).success,true);
 c.requirements[0].teacherIds=['t1'];c.slots[0].id='replacement';
 const result=generate(c);assert.equal(result.success,true);assert.ok(result.entries.every(e=>e.teacherId==='t1'));assert.ok(result.entries.some(e=>e.periodSlotId==='replacement'));assert.equal(validate(c,result.entries).valid,true);
});
test('multiple eligible teachers cannot hide a shortage of distinct periods',()=>{
 const c=context(1,3,3,[1]);c.requirements[0].teacherIds=['t0','t1','t2'];
 c.rules.avoidConsecutiveSameSubject='MANDATORY';c.requirements[0].allowConsecutive=false;
 c.fixed=[entry()];const result=generate(c);
 assert.equal(result.success,false);assert.equal(result.attempts,1);assert.match(result.reason,/only 1 valid placements remain for 2 outstanding/);assert.deepEqual(result.entries,[]);
});
test('mandatory minimum free period rule rejects a fully booked teacher',()=>{const c=context(1,1,2,[1]);c.rules.teacherFreePeriodPriority='MANDATORY';c.rules.minimumTeacherFreePeriodsPerDay=1;assert.equal(generate(c).success,false);});
test('teacher supervision can be required for a special activity slot',()=>{const c=context(1,1,2,[1]);c.requirements[0].weeklyPeriods=1;c.slots[1].type='ACTIVITY';c.requirements.push({...c.requirements[0],subjectId:'@slot:p1:1',name:'Activity',weeklyPeriods:1,periodSlotId:'p1',weekday:1});const result=generate(c);assert.equal(result.success,true);assert.equal(result.entries.filter(e=>e.subjectId.startsWith('@slot:')).length,1);});
test('availability blocks overlapping slots across different period templates',()=>{const c=context();c.availability=[{teacherId:'t0',weekday:1,periodSlotId:'other-template',startTime:'09:30',endTime:'10:30',isAvailable:false}];assert.ok(hardErrors(c,entry(),[]).includes('AVAILABILITY'));});

require('reflect-metadata');
const {TimetableRulesService}=require('../dist/timetable/timetable-rules.service');
test('failed generation never enters the persistence transaction',async()=>{
 const c=context();c.requirements[0].weeklyPeriods=100;let persisted=false;
 const service=new TimetableRulesService({$transaction:async()=>{persisted=true;}});
 service.context=async()=>({c,sections:[],templates:new Map(),year:{id:'year'},date:new Date()});
 await assert.rejects(service.generate('school',{}),/requires 100/);assert.equal(persisted,false);
});
test('service saves a complete validated eight-section batch with new versions',async()=>{
 const c=context(8,8,2,[1,2]);const saved=[],plans=[];
 const db={$transaction:async callback=>callback({timetablePlan:{findFirst:async()=>({version:2}),create:async({data})=>{const plan={id:'plan'+plans.length,...data};plans.push(plan);return plan;}},timetableEntry:{createMany:async({data})=>saved.push(...data)}})};
 const service=new TimetableRulesService(db);const sections=Array.from({length:8},(_,i)=>({id:'s'+i,classId:'c'+i}));
 service.context=async()=>({c,sections,templates:new Map(sections.map(s=>[s.id,{id:'template'}])),year:{id:'year'},date:new Date('2026-10-11')});
 const result=await service.generate('school',{});assert.equal(result.plans.length,8);assert.equal(saved.length,32);assert.ok(plans.every(p=>p.version===3));assert.ok(saved.every(e=>e.conflictCode===null));assert.equal(result.validation.valid,true);
});
test('configuration APIs reject a platform request without a school',async()=>{
 const service=new TimetableRulesService({});await assert.rejects(service.settings(null),/school account/);await assert.rejects(service.subjectConfigs(null,'year','class'),/school account/);await assert.rejects(service.teacherConfig(null,'year','teacher'),/school account/);
});

test('an explicitly mandatory morning preference excludes late core lessons',()=>{const c=context();c.rules.preferCoreSubjectsMorning='MANDATORY';assert.ok(hardErrors(c,entry('s0','t0','subject0','p1'),[]).includes('CORE_PERIOD_PREFERENCE'));});
test('mandatory distribution cannot concentrate all lessons on one day',()=>{const c=context(1,1,3,[1,2,3]);c.requirements[0].weeklyPeriods=3;c.rules.spreadSubjectsAcrossWeek='MANDATORY';assert.ok(hardErrors(c,entry('s0','t0','subject0','p1'),[entry()]).includes('SUBJECT_DISTRIBUTION'));});
test('weekly capacity failure gives the exact subject and available periods',()=>{const c=context(1,1,3,[1,2]);c.rules.maxTeacherPeriodsPerWeek=4;const r=generate(c);assert.equal(r.success,false);assert.match(r.reason,/requires 6 weekly periods.*only 4 available periods/);});

test('generation rejects workload changes detected inside the save transaction',async()=>{
 const c=context();const live=context();live.rules.maxTeacherPeriodsPerDay=1;let writes=0;
 const service=new TimetableRulesService({$transaction:async callback=>callback({timetablePlan:{create:async()=>{writes++;}}})});
 service.context=async(s,d,tx)=>({c:tx?live:c,sections:[{id:'s0',classId:'c0'}],templates:new Map([['s0',{id:'template'}]]),year:{id:'year'},date:new Date()});
 await assert.rejects(service.generate('school',{}),/changed during generation/);assert.equal(writes,0);
});
test('publishing revalidates the draft and rejects an incomplete weekly requirement',async()=>{
 const c=context();let writes=0;const db={$transaction:async callback=>callback({timetablePlan:{findFirst:async()=>({id:'plan',status:'DRAFT',academicYearId:'year',sectionId:'s0',entries:[entry()],supervisionEntries:[]}),updateMany:async()=>{writes++;}}})};
 const service=new TimetableRulesService(db);service.context=async()=>({c});
 await assert.rejects(service.publish('school','plan'),/mandatory validation/);assert.equal(writes,0);
});
test('publishing a valid draft archives the old version in the same transaction',async()=>{
 const c=context(1,1,1,[1]);const operations=[];const db={$transaction:async callback=>callback({timetablePlan:{findFirst:async()=>({id:'plan',status:'DRAFT',academicYearId:'year',sectionId:'s0',entries:[entry()],supervisionEntries:[]}),updateMany:async()=>operations.push('archive'),update:async({data})=>{operations.push('publish');return data;}}})};
 const service=new TimetableRulesService(db);service.context=async()=>({c});assert.equal((await service.publish('school','plan')).status,'PUBLISHED');assert.deepEqual(operations,['archive','publish']);
});
