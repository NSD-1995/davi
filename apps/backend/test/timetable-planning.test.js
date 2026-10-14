require('reflect-metadata');const test=require('node:test'),assert=require('node:assert/strict');const{ConflictException}=require('@nestjs/common');const{allocate,TimetablePlanningService}=require('../dist/timetable/timetable-planning.service');const slots=[{id:'p1',sequence:1},{id:'p2',sequence:2}];
test('teacher conflict prevents simultaneous allocation',()=>{const blocked=new Set(['t1:1:p1']);const r=allocate([{subjectId:'s',primaryTeacherId:'t1',weeklyPeriods:1,maxConsecutive:1}],[1],slots,blocked);assert.equal(r.entries[0].periodSlotId,'p2')});
test('section receives only one subject in a slot',()=>{const r=allocate([{subjectId:'a',primaryTeacherId:'t1',weeklyPeriods:1,maxConsecutive:1},{subjectId:'b',primaryTeacherId:'t2',weeklyPeriods:1,maxConsecutive:1}],[1],slots);assert.notEqual(r.entries[0].periodSlotId,r.entries[1].periodSlotId)});
test('missing weekly periods are returned as conflicts',()=>{const r=allocate([{subjectId:'a',primaryTeacherId:'t',weeklyPeriods:3,maxConsecutive:2}],[1],slots);assert.match(r.conflicts[0],/MISSING_PERIODS:a:1/)});
test('published timetable with conflicts cannot be published',async()=>{const p={timetablePlan:{findFirst:async()=>({id:'p',academicYearId:'y',sectionId:'s',entries:[{conflictCode:'MISSING_PERIODS'}]})}};await assert.rejects(()=>new TimetablePlanningService(p).publish('school','p'),ConflictException)});

test('deletes a timetable plan only within the current school', async()=>{
  let filter;
  const service=new TimetablePlanningService({timetablePlan:{deleteMany:async({where})=>{filter=where;return{count:1};}}});
  assert.deepEqual(await service.remove('school-1','plan-1'),{id:'plan-1',deleted:true});
  assert.deepEqual(filter,{id:'plan-1',schoolId:'school-1'});
});
test('rejects missing or other-school timetable deletion', async()=>{
  const service=new TimetablePlanningService({timetablePlan:{deleteMany:async()=>({count:0})}});
  await assert.rejects(service.remove('school-1','foreign-plan'),/Timetable plan not found/);
  await assert.rejects(service.remove(null,'plan-1'),/school account is required/);
});

test('consecutive limit counts the adjacent run rather than all subject periods that day',()=>{
 const slots=Array.from({length:5},(_,i)=>({id:'slot'+i,sequence:i+1}));
 const result=allocate([{subjectId:'subject',primaryTeacherId:'teacher',weeklyPeriods:3,maxPeriodsPerDay:3,maxConsecutive:1}],[1],slots);
 assert.equal(result.entries.length,3);assert.deepEqual(result.conflicts,[]);
 assert.deepEqual(result.entries.map(e=>e.periodSlotId),['slot0','slot2','slot4']);
});

test('existing generation API delegates to validated rule-based generation',async()=>{
 let request;const rules={generate:async(s,d)=>{request={s,d};return{version:3,conflicts:[]};}};
 const data={academicYearId:'year',classId:'class',sectionId:'section',date:'2026-10-11'};
 const result=await new TimetablePlanningService({},rules).generate('school',data);
 assert.equal(result.version,3);assert.deepEqual(request,{s:'school',d:data});
});
