const {test}=require('node:test');
const assert=require('node:assert/strict');
const {BadRequestException,ConflictException,ForbiddenException}=require('@nestjs/common');
const {curriculumSchema,calendarSchema,dateOnly}=require('../dist/academic-workflow/workflow.dto');
const {buildTeachingPlan,flattenTopics,analyzeEvidence}=require('../dist/academic-workflow/planner');
const {WorkflowService}=require('../dist/academic-workflow/workflow.service');
const id='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222';
const topic={code:'T1',title:'Counting',subtopics:['Objects'],outcomes:['Count ten objects'],prerequisites:[],periods:2};
const curriculum={units:[{title:'Numbers',termId:id,lessons:[{title:'Counting',topics:[topic,{...topic,code:'T2',title:'Addition',prerequisites:['T1'],periods:1}]}]}]};
const calendar={terms:[{id,start:'2026-10-05',end:'2026-10-16'}],workingDays:[1,2,3,4,5],holidays:[{date:'2026-10-06',label:'Holiday'}],unavailableDates:['2026-10-07'],weeklySlots:[1,2,3,4,5].map(weekday=>({weekday,start:'09:00',minutes:40})),revisionPeriods:1};
const program={id,schoolId:id,academicYearId:id,classId:id,sectionId:id,subjectId:id,syllabusId:id,curriculum,calendar,status:'APPROVED',revision:0};
const user={id,schoolId:id,roles:['school-admin']};
function service(extra={},p=program){const db={academicProgram:{findFirst:async()=>p},section:{findFirst:async()=>({id})},...extra};return new WorkflowService(db,{assert:async()=>({})},{});}

test('calendar skips weekends, holidays and teacher unavailable days, preserves prerequisites',()=>{
  const result=buildTeachingPlan(curriculum,calendar,'2026-10-05');
  assert.deepEqual(result.sessions.map(s=>[s.topicCode,s.date]),[['T1','2026-10-05'],['T1','2026-10-08'],['T2','2026-10-09']]);assert.equal(result.shortages.length,0);
});
test('replanning counts completed periods and avoids occupied slots',()=>{
  const result=buildTeachingPlan(curriculum,calendar,'2026-10-08',{T1:1},['2026-10-08:09:00']);
  assert.deepEqual(result.sessions.map(s=>[s.topicCode,s.date]),[['T1','2026-10-09'],['T2','2026-10-12']]);
});
test('capacity shortage is explicit and dependent topics are not scheduled early',()=>{
  const result=buildTeachingPlan(curriculum,{...calendar,terms:[{id,start:'2026-10-05',end:'2026-10-05'}],revisionPeriods:0},'2026-10-05');
  assert.deepEqual(result.shortages.map(s=>s.topicCode),['T1','T2']);assert.equal(result.sessions.length,1);
});
test('a prerequisite reserved in the future cannot be followed by an earlier dependent lesson',()=>{
  const result=buildTeachingPlan(curriculum,calendar,'2026-10-05',{T1:2},['2026-10-12:09:00'],{T1:'2026-10-12:09:00'});
  assert.equal(result.sessions[0].topicCode,'T2');assert.equal(result.sessions[0].date,'2026-10-13');
});
test('curriculum rejects duplicate topic IDs, invalid prerequisites and missing outcomes',()=>{
  const duplicate=structuredClone(curriculum);duplicate.units[0].lessons[0].topics[1].code='T1';assert.equal(curriculumSchema.safeParse(duplicate).success,false);
  const forward=structuredClone(curriculum);forward.units[0].lessons[0].topics[0].prerequisites=['T2'];assert.equal(curriculumSchema.safeParse(forward).success,false);
  const empty=structuredClone(curriculum);empty.units[0].lessons[0].topics[0].outcomes=[];assert.equal(curriculumSchema.safeParse(empty).success,false);
});
test('calendar rejects impossible dates, overlapping terms and overlapping weekly slots',()=>{
  assert.equal(dateOnly.safeParse('2026-02-30').success,false);
  assert.equal(calendarSchema.safeParse({...calendar,terms:[...calendar.terms,{id:other,start:'2026-10-10',end:'2026-10-20'}]}).success,false);
  assert.equal(calendarSchema.safeParse({...calendar,weeklySlots:[{weekday:1,start:'09:00',minutes:40},{weekday:1,start:'09:30',minutes:40}]}).success,false);
});
test('learning gaps use normalized question marks; absent/missing evidence is not zero mastery',()=>{
  const papers=[{id,status:'PUBLISHED',content:{questions:[{code:'Q1',topicCode:'T1',outcome:topic.outcomes[0],marks:2},{code:'Q2',topicCode:'T1',outcome:topic.outcomes[0],marks:8}]}}];
  const results=[{paperId:id,enrollmentId:id,absent:false,scores:[{questionCode:'Q1',marks:2},{questionCode:'Q2',marks:2}]},{paperId:id,enrollmentId:other,absent:true,scores:[]}];
  const output=analyzeEvidence(flattenTopics(curriculum),papers,results,[{id},{id:other}],[{enrollmentId:id,status:'ABSENT'}]);
  assert.equal(output[0].topics[0].percentage,40);assert.equal(output[0].topics[0].status,'NEEDS_SUPPORT');assert.equal(output[0].topics[1].status,'NO_EVIDENCE');assert.equal(output[1].topics[0].percentage,null);assert.equal(output[0].attendance.presentDays,0);
});
test('curriculum approval requires a saved human review',async()=>{
  await assert.rejects(service({}, {...program,status:'DRAFT',reviewedAt:null}).approve(user,id,{revision:0}),ConflictException);
});
test('parent summary endpoint rejects an unrelated enrollment before loading summaries',async()=>{
  let read=false;const s=service({studentEnrollment:{findFirst:async()=>null},academicInsight:{findMany:async()=>{read=true;}}});
  await assert.rejects(s.parentInsights(user,other),ForbiddenException);assert.equal(read,false);
});
test('parent summary query returns only published parent content and excludes evidence',async()=>{
  let query;const s=service({studentEnrollment:{findFirst:async()=>({...program})},academicInsight:{findMany:async q=>{query=q;return [];}}});await s.parentInsights(user,id);assert.equal(query.where.status,'PUBLISHED');assert.equal(query.where.audience,'PARENT');assert.equal(query.select.evidence,undefined);
});
test('question marks reject out-of-range, missing, duplicate and absent scores',async()=>{
  const paper={id,programId:id,status:'PUBLISHED',content:{title:'Test',instructions:'Answer',questions:[{code:'Q1',topicCode:'T1',outcome:topic.outcomes[0],prompt:'Count',answer:'Ten',marks:5,difficulty:'EASY'}]}};
  const s=service({academicPaper:{findFirst:async()=>paper},studentEnrollment:{findFirst:async()=>({id})}});
  for(const scores of [[],[{questionCode:'Q1',marks:6}],[{questionCode:'Q2',marks:2}],[{questionCode:'Q1',marks:1},{questionCode:'Q1',marks:1}]])await assert.rejects(s.marks(user,id,id,{revision:0,enrollmentId:id,absent:false,scores}),BadRequestException);
  await assert.rejects(s.marks(user,id,id,{revision:0,enrollmentId:id,absent:true,scores:[{questionCode:'Q1',marks:0}]}),BadRequestException);
});
test('marks reject students outside the program section',async()=>{
  const s=service({academicPaper:{findFirst:async()=>({id,status:'PUBLISHED'})},studentEnrollment:{findFirst:async()=>null}});await assert.rejects(s.marks(user,id,id,{revision:0,enrollmentId:other,absent:true,scores:[]}),ForbiddenException);
});
test('paper cannot publish before human review',async()=>{
  const s=service({academicPaper:{findFirst:async()=>({id,status:'DRAFT',reviewedAt:null})}});await assert.rejects(s.publishPaper(user,id,id,{revision:0}),ConflictException);
});
test('draft lesson cannot be marked taught',async()=>{
  const s=service({academicTeachingSession:{findFirst:async()=>({id,lessonStatus:'DRAFT'})}});await assert.rejects(s.progress(user,id,id,{revision:0,status:'COMPLETED',notes:''}),ConflictException);
});
test('stale paper edits cannot overwrite reviewed changes',async()=>{
  const content={title:'Test',instructions:'Answer',questions:[{code:'Q1',topicCode:'T1',outcome:topic.outcomes[0],prompt:'Count',answer:'Ten',marks:5,difficulty:'EASY'}]};
  const s=service({academicPaper:{findFirst:async()=>({id,status:'DRAFT'}),updateMany:async()=>({count:0})}});await assert.rejects(s.reviewPaper(user,id,id,{revision:0,content}),ConflictException);
});
test('question outcome must belong to the exact referenced topic',async()=>{
  const content={title:'Test',instructions:'Answer',questions:[{code:'Q1',topicCode:'T1',outcome:'Unrelated outcome',prompt:'Count',answer:'Ten',marks:5,difficulty:'EASY'}]};
  const s=service({academicPaper:{findFirst:async()=>({id,status:'DRAFT'})}});await assert.rejects(s.reviewPaper(user,id,id,{revision:0,content}),BadRequestException);
});
