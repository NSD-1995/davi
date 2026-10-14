require('reflect-metadata');
const test = require('node:test');
const assert = require('node:assert/strict');
const { assertClassTeacherAvailable } = require('../dist/teachers/class-teacher-assignment');
function db(rows) { return { teacherAcademicAssignment: { findFirst: async ({where}) => rows.find(r => r.schoolId === where.schoolId && r.academicYearId === where.academicYearId && r.teacherId === where.teacherId && r.isClassTeacher && r.isActive && !(r.classId === where.NOT.classId && r.sectionId === where.NOT.sectionId)) } }; }
const assignment = {schoolId:'school',academicYearId:'year',teacherId:'teacher',classId:'class1',sectionId:'section1',isClassTeacher:true,isActive:true};
test('rejects an active class teacher in another class or section', async () => {
  for (const [c,s] of [['class2','section2'],['class1','section2']]) await assert.rejects(assertClassTeacherAvailable(db([assignment]),'school','year','teacher',c,s), /already assigned as class teacher/);
});
test('allows retaining current class teacher and assignments in a different year', async () => {
  await assertClassTeacherAvailable(db([assignment]),'school','year','teacher','class1','section1');
  await assertClassTeacherAvailable(db([assignment]),'school','nextYear','teacher','class2','section2');
});
test('allows inactive and subject teacher assignments', async () => {
  for (const row of [{...assignment,isActive:false},{...assignment,isClassTeacher:false}]) await assertClassTeacherAvailable(db([row]),'school','year','teacher','class2','section2');
});

const {TeachersService}=require('../dist/teachers/teachers.service');
function replacementService(occupied=false){
 const operations=[];const prisma={staff:{findFirst:async()=>({id:'staff'})},$transaction:async callback=>callback({teacherAcademicAssignment:{findFirst:async()=>occupied?{teacherId:'replacement',classId:'another',sectionId:'another-section'}:null,updateMany:async({where,data})=>{operations.push({where,data});return{count:1};},create:async({data})=>{operations.push({created:data});return data;}}})};
 const service=new TeachersService(prisma);service.assertAcademicScope=async()=>{};service.findOne=async()=>({status:'ACTIVE',userId:'user',user:{status:'ACTIVE'}});return{service,operations};
}
test('allows replacing a class teacher and retains historical and subject assignments',async()=>{
 const {service,operations}=replacementService();const result=await service.replaceClassTeacher('school','year','class','section','replacement');
 assert.equal(result.teacherId,'replacement');assert.equal(result.responsibilityType,'LEAD_TEACHER');
 assert.equal(operations[0].where.subjectId,null);assert.equal(operations[0].data.isActive,false);
 assert.deepEqual(operations[1].where.subjectId,{not:null});assert.deepEqual(operations[1].data,{isClassTeacher:false});
});
test('replacement assigned elsewhere is rejected before changing the current class teacher',async()=>{
 const {service,operations}=replacementService(true);await assert.rejects(service.replaceClassTeacher('school','year','class','section','replacement'),/already assigned as class teacher/);assert.deepEqual(operations,[]);
});
test('inactive teachers cannot replace the current class teacher',async()=>{
 const {service,operations}=replacementService();service.findOne=async()=>({status:'INACTIVE',userId:'user',user:{status:'ACTIVE'}});await assert.rejects(service.replaceClassTeacher('school','year','class','section','replacement'),/active teaching staff/);assert.deepEqual(operations,[]);
});
