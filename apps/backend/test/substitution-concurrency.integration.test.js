require('reflect-metadata');
const test=require('node:test'),assert=require('node:assert/strict');
const {randomUUID}=require('node:crypto');
const {PrismaClient}=require('@prisma/client');
const {CoverageService}=require('../dist/timetable/coverage.service');
const {TimetableRulesService}=require('../dist/timetable/timetable-rules.service');
const {OperationsAccessService}=require('../dist/auth/operations-access.service');
test('PostgreSQL: concurrent coordinators cannot approve one teacher for two overlapping classes',{skip:process.env.OPERATIONS_DB_TEST!=='1'},async()=>{
 const db=new PrismaClient();let school;
 try{
  const fixture=await db.$transaction(async tx=>{
   school=await tx.school.create({data:{name:'Concurrency fixture',slug:'operations-race-'+randomUUID()}});
   const schoolId=school.id,date=new Date('2099-10-13'),weekday=date.getUTCDay()||7;
   const year=await tx.academicYear.create({data:{schoolId,name:'Fixture',startDate:new Date('2099-01-01'),endDate:new Date('2099-12-31')}});
   const admin=await tx.user.create({data:{schoolId,email:'admin@fixture.invalid',passwordHash:'fixture',firstName:'Admin',lastName:'Fixture'}});
   const role=await tx.role.create({data:{schoolId,name:'Fixture admin',code:'SCHOOL_ADMIN'}});
   await tx.userRole.create({data:{schoolId,userId:admin.id,roleId:role.id}});
   const subject=await tx.subject.create({data:{schoolId,name:'English',code:'ENG'}}),people=[];
   for(let i=0;i<3;i++){
    const user=await tx.user.create({data:{schoolId,email:i+'@fixture.invalid',passwordHash:'fixture',firstName:'Teacher',lastName:String(i)}});
    const staff=await tx.staff.create({data:{schoolId,userId:user.id,employeeId:String(i)}});
    const teacher=await tx.teacher.create({data:{schoolId,userId:user.id,teacherCode:String(i),capableSubjectIds:[subject.id],timetableEligibility:{canSubstitute:i===2}}});
    await tx.staffAttendance.create({data:{schoolId,staffId:staff.id,date,status:i===2?'PRESENT':'ABSENT',markedById:admin.id}});
    people.push(teacher);
   }
   await tx.schoolSetting.create({data:{schoolId,coveragePolicy:{timeZone:'UTC',requirePresent:true,inChargeUserIds:[]}}});
   const template=await tx.periodTimingTemplate.create({data:{schoolId,academicYearId:year.id,familyId:randomUUID(),name:'Fixture',workingDays:[weekday],schoolStartTime:'09:00',schoolEndTime:'10:00',effectiveFrom:new Date('2099-01-01'),status:'ACTIVE',createdById:admin.id,updatedById:admin.id,slots:{create:{name:'Lesson',type:'TEACHING',sequence:1,startTime:'09:00',endTime:'10:00',applicableDays:[weekday]}}},include:{slots:true}});
   const subs=[];
   for(let i=0;i<2;i++){
    const schoolClass=await tx.schoolClass.create({data:{schoolId,academicYearId:year.id,name:'Fixture '+i}}),section=await tx.section.create({data:{schoolId,classId:schoolClass.id,name:'A'}});
    const plan=await tx.timetablePlan.create({data:{schoolId,academicYearId:year.id,classId:schoolClass.id,sectionId:section.id,templateId:template.id,status:'PUBLISHED',subjectConfigFingerprint:'fixture'}});
    const entry=await tx.timetableEntry.create({data:{schoolId,academicYearId:year.id,classId:schoolClass.id,sectionId:section.id,subjectId:subject.id,teacherId:people[i].id,weekday,periodSlotId:template.slots[0].id,timetablePlanId:plan.id}});
    subs.push(await tx.timetableSubstitution.create({data:{schoolId,date,targetKey:'lesson:'+entry.id,timetableEntryId:entry.id,timetablePlanId:plan.id,periodSlotId:template.slots[0].id,originalTeacherId:people[i].id,substituteTeacherId:people[2].id,status:'PROPOSED'}}));
   }
   return{admin,people,subs};
  });
  const service=new CoverageService(db,new TimetableRulesService(db),new OperationsAccessService(db));
  const results=await Promise.allSettled(fixture.subs.map(sub=>service.assign(school.id,sub.id,fixture.people[2].id,'2099-10-13',fixture.admin.id)));
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
  const rejected=results.find(r=>r.status==='rejected');assert.equal(rejected.reason.getStatus(),409);
  assert.equal(await db.timetableSubstitution.count({where:{schoolId:school.id,status:'APPROVED'}}),1);
 }finally{
  if(school){await db.timetablePlan.deleteMany({where:{schoolId:school.id}});await db.school.delete({where:{id:school.id}});}
  await db.$disconnect();
 }
});
