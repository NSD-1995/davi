const {test}=require('node:test');
const assert=require('node:assert/strict');
const {BadRequestException,ForbiddenException,ConflictException}=require('@nestjs/common');
const {lessonRequestSchema,lessonPlanSchema}=require('../dist/ai/ai.dto');
const {AcademicScopeService}=require('../dist/ai/academic-scope.service');
const {SyllabusService}=require('../dist/syllabus/syllabus.service');

const id='11111111-1111-4111-8111-111111111111';
const other='22222222-2222-4222-8222-222222222222';
const input={schoolId:id,academicYearId:id,classId:id,subjectId:id,topic:'Numbers 1 to 10',durationMinutes:40,language:'English'};
test('lesson request and provider output reject malformed content',()=>{
  assert.equal(lessonRequestSchema.safeParse({...input,durationMinutes:0}).success,false);
  assert.equal(lessonRequestSchema.safeParse({...input,extra:'unsafe'}).success,false);
  assert.equal(lessonPlanSchema.safeParse({objectives:[]}).success,false);
});
test('cross-school access is denied before database lookup',async()=>{
  const scope=new AcademicScopeService({});
  await assert.rejects(scope.assert({id:id,schoolId:other,roles:[]},input),ForbiddenException);
});
test('invalid class-subject assignment is rejected',async()=>{
  const db={academicYear:{findFirst:async()=>({id})},schoolClass:{findFirst:async()=>({id})},subject:{findFirst:async()=>({id})},classSubject:{findFirst:async()=>null}};
  await assert.rejects(new AcademicScopeService(db).assert({id,schoolId:id,roles:['school-admin']},input),BadRequestException);
});
test('unassigned teacher is denied',async()=>{
  const found={findFirst:async()=>({id})};
  const db={academicYear:found,schoolClass:found,subject:found,classSubject:found,teacher:found,teacherAcademicAssignment:{findFirst:async()=>null}};
  await assert.rejects(new AcademicScopeService(db).assert({id,schoolId:id,roles:['teacher']},input),ForbiddenException);
});
test('approval requires human review',async()=>{
  const syllabus={id,schoolId:id,academicYearId:id,classId:id,subjectId:id,termId:id,status:'DRAFT',reviewedAt:null,lessons:[{topics:[{id}]}]};
  const db={syllabus:{findFirst:async()=>syllabus},schoolTerm:{findFirst:async()=>({id})}};
  const service=new SyllabusService(db,{assert:async()=>({})});
  await assert.rejects(service.approve({id,schoolId:id,roles:['school-admin']},id),BadRequestException);
});
test('review rejects empty topics and preserves explicit order',async()=>{
  const syllabus={id,schoolId:id,academicYearId:id,classId:id,subjectId:id,termId:id,status:'DRAFT',lessons:[]};
  const created=[];
  const db={syllabus:{findFirst:async()=>syllabus,update:async()=>({})},schoolTerm:{findFirst:async()=>({id})},$transaction:async fn=>fn({syllabusTopic:{deleteMany:async()=>{}},syllabusLesson:{deleteMany:async()=>{},create:async row=>created.push(row.data)}})};
  const service=new SyllabusService(db,{assert:async()=>({})});
  await assert.rejects(service.review({id,schoolId:id,roles:['school-admin']},id,{lessons:[{title:'Numbers',topics:[]}]}),BadRequestException);
  await service.review({id,schoolId:id,roles:['school-admin']},id,{lessons:[{title:'Numbers',topics:['Numbers 1 to 10','Counting objects']}]});
  assert.deepEqual(created[0].topics.create.map(t=>[t.title,t.sortOrder]),[['Numbers 1 to 10',1],['Counting objects',2]]);
});
