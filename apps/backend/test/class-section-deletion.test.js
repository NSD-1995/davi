require('reflect-metadata');
const test=require('node:test'),assert=require('node:assert/strict');
const {Prisma}=require('@prisma/client');
const {SchoolClassesService}=require('../dist/classes/classes.service');
const {SectionsService}=require('../dist/sections/sections.service');
for(const [name,Service,model] of [['class',SchoolClassesService,'schoolClass'],['section',SectionsService,'section']]){
 test('deletes an unused '+name+' in the current school',async()=>{
  let deleted=false;const db={teacherAcademicAssignment:{count:async()=>0},studentEnrollment:{count:async()=>0},timetableEntry:{count:async()=>0},[model]:{findUnique:async()=>({id:'id',schoolId:'school'}),delete:async()=>{deleted=true;return{id:'id'};}}};
  assert.deepEqual(await new Service(withTransaction(db)).remove('id','school'),{id:'id'});assert.equal(deleted,true);
 });
 test('rejects cross-school '+name+' deletion',async()=>{
  let deleted=false;const db={[model]:{findUnique:async()=>({id:'id',schoolId:'other'}),delete:async()=>{deleted=true;}}};
  await assert.rejects(new Service(withTransaction(db)).remove('id','school'),/own school/);assert.equal(deleted,false);
 });
 test('returns a clear conflict for a referenced '+name,async()=>{
  const db={[model]:{findUnique:async()=>({id:'id',schoolId:'school'}),delete:async()=>{throw new Prisma.PrismaClientKnownRequestError('referenced',{code:'P2003',clientVersion:'5.17.0'});}}};
  await assert.rejects(new Service(withTransaction(db)).remove('id','school'),e=>e.getStatus()===409&&/INACTIVE/.test(e.message));
 });
}


function withTransaction(db){db.teacherAcademicAssignment??={};db.studentEnrollment??={count:async()=>0};db.timetableEntry??={count:async()=>0};db.teacherAcademicAssignment.deleteMany=async()=>({count:1});db.periodTemplateAssignment={deleteMany:async()=>({count:1})};db.$transaction=async callback=>callback(db);return db;}
test('removes teacher and timing assignments before deleting the section',async()=>{
 const operations=[];const tx={studentEnrollment:{count:async()=>0},timetableEntry:{count:async()=>0},teacherAcademicAssignment:{deleteMany:async()=>operations.push('teacher')},periodTemplateAssignment:{deleteMany:async()=>operations.push('timing')},section:{delete:async()=>{operations.push('section');return{id:'section'};}}};
 const db={section:{findUnique:async()=>({schoolId:'school'})},$transaction:async callback=>callback(tx)};
 await new SectionsService(db).remove('section','school');assert.deepEqual(operations,['teacher','timing','section']);
});
test('blocks enrolled sections before removing assignments',async()=>{
 const db=withTransaction({section:{findUnique:async()=>({schoolId:'school'})},teacherAcademicAssignment:{},studentEnrollment:{count:async()=>1},timetableEntry:{count:async()=>0}});
 await assert.rejects(new SectionsService(db).remove('section','school'),/1 student enrollment/);
});
test('converts PostgreSQL RESTRICT unknown-request errors into a conflict',async()=>{
 const db=withTransaction({section:{findUnique:async()=>({schoolId:'school'}),delete:async()=>{throw new Prisma.PrismaClientUnknownRequestError('violates RESTRICT setting of foreign key constraint',{clientVersion:'5.17.0'});}},teacherAcademicAssignment:{},studentEnrollment:{count:async()=>0},timetableEntry:{count:async()=>0}});
 await assert.rejects(new SectionsService(db).remove('section','school'),e=>e.getStatus()===409);
});
