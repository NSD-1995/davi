require('reflect-metadata');
const test=require('node:test'),assert=require('node:assert/strict');
const {ClassWorkspaceService}=require('../dist/class-workspace/class-workspace.service');
test('workspace list includes current teacher details and counts unique subject teachers',async()=>{
 const teacher={id:'teacher',teacherCode:'T01',user:{firstName:'Test',lastName:'Teacher'}};
 const db={schoolClass:{findMany:async()=>[{id:'class',name:'LKG',code:'LKG',status:'ACTIVE',capacity:25,sections:[{id:'section',name:'A',status:'ACTIVE',capacity:25,room:'101'}]}]},studentEnrollment:{groupBy:async()=>[{sectionId:'section',_count:{_all:3}}],findMany:async()=>[{id:'student',sectionId:'section'}]},studentAttendance:{groupBy:async()=>[{enrollmentId:'student',status:'PRESENT',_count:{_all:1}}]},teacherAcademicAssignment:{findMany:async({where})=>{assert.equal(where.isActive,true);assert.equal(where.schoolId,'school');return[{sectionId:'section',teacherId:'teacher',isClassTeacher:true,subjectId:null,teacher},{sectionId:'section',teacherId:'teacher',isClassTeacher:false,subjectId:'english',teacher},{sectionId:'section',teacherId:'teacher',isClassTeacher:false,subjectId:'math',teacher}];}}};
 const service=new ClassWorkspaceService(db);service.scope=async()=>{};const [result]=await service.workspaces('school','year');
 assert.equal(result.code,'LKG');assert.equal(result.sections[0].classTeacherDetails.teacherCode,'T01');assert.equal(result.sections[0].classTeacherDetails.firstName,'Test');assert.equal(result.sections[0].subjectTeacherCount,1);assert.equal(result.sections[0].todayAttendance.notMarked,2);assert.equal(result.classTeacherMissingCount,0);
});
