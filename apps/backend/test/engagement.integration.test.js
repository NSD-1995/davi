require('reflect-metadata');
const test=require('node:test'),assert=require('node:assert/strict'),{randomUUID}=require('node:crypto');
const {PrismaClient}=require('@prisma/client'),{EngagementService}=require('../dist/engagement/engagement.service'),{OperationsAccessService}=require('../dist/auth/operations-access.service');
const url=process.env.DAVI_ENGAGEMENT_TEST_DATABASE_URL;
test('PostgreSQL participant privacy, activity ownership, lifecycle concurrency, transactional audit and notification read independence',{skip:!url,timeout:60000},async()=>{
 const db=new PrismaClient({datasources:{db:{url}}}),prefix='engagement-test-'+randomUUID(),service=new EngagementService(db,new OperationsAccessService(db));
 const users=[],schools=[];
 try{
  const school=await db.school.create({data:{name:'Synthetic Montessori',slug:prefix}});schools.push(school.id);const other=await db.school.create({data:{name:'Foreign fixture',slug:prefix+'-other'}});schools.push(other.id);
  const makeUser=async(s,name)=>{const u=await db.user.create({data:{schoolId:s,email:randomUUID()+'@invalid.test',firstName:name,lastName:'Fixture',passwordHash:'unusable-fixture',mustChangePassword:false}});users.push(u.id);return u;};
  const admin=await makeUser(school.id,'Admin'),teacher=await makeUser(school.id,'Teacher'),unrelated=await makeUser(school.id,'Unrelated'),foreign=await makeUser(other.id,'Foreign'),parent=await makeUser(null,'Parent'),outsider=await makeUser(null,'Other parent'),studentUser=await makeUser(null,'Child');
  for(const [u,code]of [[admin,'SCHOOL_ADMIN'],[foreign,'SCHOOL_ADMIN'],[teacher,'TEACHER'],[unrelated,'STAFF']]){const role=await db.role.create({data:{schoolId:u.schoolId,name:code,code}});await db.userRole.create({data:{userId:u.id,roleId:role.id,schoolId:u.schoolId}});for(const code of ['COMMUNICATION_VIEW','LESSON_PLAN_VIEW','LESSON_PLAN_MANAGE']){const p=await db.permission.upsert({where:{code},update:{},create:{code,module:'TEST',action:'VIEW'}});await db.rolePermission.create({data:{roleId:role.id,permissionId:p.id}});}}
  await db.staff.create({data:{schoolId:school.id,userId:teacher.id,employeeId:'T',staffCategory:'TEACHING'}});
  const t=await db.teacher.create({data:{schoolId:school.id,userId:teacher.id,teacherCode:'T'}}),year=await db.academicYear.create({data:{schoolId:school.id,name:'2026',isCurrent:true}}),c=await db.schoolClass.create({data:{schoolId:school.id,academicYearId:year.id,name:'Montessori'}}),section=await db.section.create({data:{schoolId:school.id,classId:c.id,name:'A'}});
  await db.teacherAcademicAssignment.create({data:{schoolId:school.id,teacherId:t.id,academicYearId:year.id,classId:c.id,sectionId:section.id,isClassTeacher:true}});
  const student=await db.student.create({data:{userId:studentUser.id,studentCode:randomUUID()}}),enrollment=await db.studentEnrollment.create({data:{schoolId:school.id,studentId:student.id,academicYearId:year.id,classId:c.id,sectionId:section.id,admissionNumber:'1'}}),p=await db.parent.create({data:{userId:parent.id}});
  await db.parentSchoolMembership.create({data:{parentId:p.id,schoolId:school.id,parentCode:'P'}});await db.studentParent.create({data:{studentId:student.id,parentId:p.id}});
  const q=await service.createQuery(parent,{enrollmentId:enrollment.id,category:'School activity',subject:'Activity question',message:'Private family question'});assert.equal(q.assignedToId,teacher.id);assert.equal(q.status,'ASSIGNED');
  for(const actor of [outsider,unrelated,foreign])await assert.rejects(()=>service.detail(actor,q.id));
  assert.equal((await service.detail(parent,q.id)).messages[0].message,'Private family question');
  await assert.rejects(()=>service.changeQuery(parent,q.id,{version:1,status:'RESOLVED'}));
  await service.changeQuery(teacher,q.id,{version:1,message:'Teacher reply'});assert.equal((await db.parentQuery.findUnique({where:{id:q.id}})).status,'ASSIGNED');
  await assert.rejects(()=>service.changeQuery(teacher,q.id,{version:1,status:'RESOLVED'}));
  await service.changeQuery(teacher,q.id,{version:2,status:'AWAITING_PARENT'});await service.changeQuery(parent,q.id,{version:3,message:'Clarification'});assert.equal((await db.parentQuery.findUnique({where:{id:q.id}})).status,'IN_PROGRESS');
  const notification=await db.notification.findFirst({where:{schoolId:school.id,recipientId:teacher.id}});await db.notification.update({where:{id:notification.id},data:{readAt:new Date()}});assert.equal((await db.parentQuery.findUnique({where:{id:q.id}})).status,'IN_PROGRESS');
  await service.changeQuery(teacher,q.id,{version:4,status:'ESCALATED'});await service.changeQuery(admin,q.id,{version:5,status:'RESOLVED'});assert.ok((await db.parentQuery.findUnique({where:{id:q.id}})).resolvedAt);await assert.rejects(()=>service.changeQuery(teacher,q.id,{version:6,message:'Reopen'}));
  const input={academicYearId:year.id,classId:c.id,sectionId:section.id,teacherId:t.id,title:'Sensorial work',category:'Sensorial Development',date:'2026-10-30',startTime:'10:00',endTime:'10:30'};
  await assert.rejects(()=>service.createActivity(foreign,input));await assert.rejects(()=>service.createActivity(unrelated,input));
  const a=await service.createActivity(teacher,input);assert.equal(a.status,'PLANNED');await assert.rejects(()=>service.changeActivity(teacher,a.id,{version:1,status:'COMPLETED'}));await assert.rejects(()=>service.changeActivity(unrelated,a.id,{version:1,status:'IN_PROGRESS'}));
  await service.changeActivity(teacher,a.id,{version:1,status:'IN_PROGRESS'});await assert.rejects(()=>service.changeActivity(teacher,a.id,{version:1,status:'CANCELLED'}));await service.changeActivity(teacher,a.id,{version:2,status:'COMPLETED'});assert.ok((await db.dailyActivity.findUnique({where:{id:a.id}})).completedAt);
  assert.ok(await db.auditLog.count({where:{schoolId:school.id,entityId:q.id}})>=6);assert.equal(await db.notification.count({where:{schoolId:school.id,dedupeKey:{startsWith:'QUERY:'+q.id}}}),7);
  const alerts=await service.personalAlerts(parent);assert.ok(alerts.length>0);await service.readPersonalAlert(parent,alerts[0].id);assert.equal((await db.parentQuery.findUnique({where:{id:q.id}})).status,'RESOLVED');await assert.rejects(()=>service.readPersonalAlert(outsider,alerts[0].id));
  // Exercise real Nest DI, HTTP guards and the consolidated dashboard API.
  const {Module}=require('@nestjs/common'),{NestFactory}=require('@nestjs/core'),{JwtService}=require('@nestjs/jwt');
  const {PrismaModule}=require('../dist/prisma/prisma.module'),{AuthModule}=require('../dist/auth/auth.module'),{EngagementModule}=require('../dist/engagement/engagement.module'),{DashboardModule}=require('../dist/dashboard/dashboard.module');
  const previous=process.env.DATABASE_URL;process.env.DATABASE_URL=url;class FixtureModule{};Module({imports:[PrismaModule,AuthModule,EngagementModule,DashboardModule]})(FixtureModule);
  const app=await NestFactory.create(FixtureModule,{logger:false,abortOnError:false});try{app.setGlobalPrefix('api/v1');await app.listen(0,'127.0.0.1');const base=(await app.getUrl())+'/api/v1',jwt=new JwtService({secret:process.env.JWT_SECRET||'davi-super-secret-key'}),headers=u=>({Authorization:'Bearer '+jwt.sign({sub:u.id})});
   assert.equal((await fetch(base+'/engagement/queries/'+q.id)).status,401);assert.equal((await fetch(base+'/engagement/queries/'+q.id,{headers:headers(foreign)})).status,404);assert.equal((await fetch(base+'/engagement/queries/'+q.id,{headers:headers(parent)})).status,200);
   const result=await fetch(base+'/dashboard/command-center?'+new URLSearchParams({academicYearId:year.id,date:'2026-10-30'}),{headers:headers(admin)});assert.equal(result.status,200);const summary=await result.json();assert.equal(summary.clock.date,'2026-10-30');assert.equal(summary.school.id,school.id);assert.equal(summary.activitySummary.completed,1);assert.ok(summary.parentQueries);assert.ok(summary.actionGroups);assert.equal(summary.errors.dailyActivities,undefined);assert.equal(summary.errors.parentQueries,undefined);assert.ok(!JSON.stringify(summary.parentQueries).includes('Private family question'));
   await db.studentEnrollment.update({where:{id:enrollment.id},data:{admissionDate:new Date('2026-10-01')}});
   await db.schoolSetting.upsert({where:{schoolId:school.id},create:{schoolId:school.id,timezone:'Asia/Kolkata',operationsPolicy:{workingDays:[1,2,3,4,5,6,7],studentAttendanceDeadline:'09:30'}},update:{operationsPolicy:{workingDays:[1,2,3,4,5,6,7],studentAttendanceDeadline:'09:30'}}});
   const {DashboardOperationsService}=require('../dist/dashboard/dashboard-operations.service'),dashboard=app.get(DashboardOperationsService);
   const early=await dashboard.get(school.id,admin.id,year.id,'2026-10-30',new Date('2026-10-30T02:00:00Z'));assert.equal(early.attendance.expected,1);assert.equal(early.attendance.notMarked,1);assert.equal(early.attendance.percentage,null);assert.equal(early.actionGroups.find(a=>a.key==='attendance').status,'PENDING');
   const late=await dashboard.get(school.id,admin.id,year.id,'2026-10-30',new Date('2026-10-30T06:00:00Z'));assert.equal(late.actionGroups.find(a=>a.key==='attendance').status,'OVERDUE');
   await db.schoolEvent.create({data:{schoolId:school.id,title:'Holiday fixture',eventType:'HOLIDAY',audience:'ALL',startsAt:new Date('2026-10-30T00:00:00Z')}});
   const holiday=await dashboard.get(school.id,admin.id,year.id,'2026-10-30',new Date('2026-10-30T06:00:00Z'));assert.equal(holiday.attendance.expected,0);assert.ok(!holiday.actionGroups.some(a=>a.key==='attendance'));
   const q2=await service.createQuery(parent,{enrollmentId:enrollment.id,category:'Other',subject:'Concurrency',message:'Question'});
   const contenders=await Promise.allSettled([service.changeQuery(teacher,q2.id,{version:1,message:'First response'}),service.changeQuery(teacher,q2.id,{version:1,message:'Second response'})]);assert.equal(contenders.filter(r=>r.status==='fulfilled').length,1);assert.equal(await db.parentQueryMessage.count({where:{queryId:q2.id}}),2);
   assert.equal((await fetch(base+'/dashboard/command-center?date=2026-02-30',{headers:headers(admin)})).status,400);
   assert.equal((await fetch(base+'/teacher-cover/automation',{headers:headers(teacher)})).status,403);
   const automation=await fetch(base+'/teacher-cover/automation',{headers:headers(admin)});assert.equal(automation.status,200);assert.equal((await automation.json()).intervalSeconds,60);
   const job=await fetch(base+'/teacher-cover/automation/run',{method:'POST',headers:headers(admin)});assert.equal(job.status,201);assert.equal(typeof (await job.json()).coverage.assigned,'number');
   const jobStatus=await fetch(base+'/teacher-cover/automation',{headers:headers(admin)});assert.equal((await jobStatus.json()).lastRun.state,'SUCCEEDED');assert.ok(await db.auditLog.count({where:{schoolId:school.id,action:'OPERATIONS_JOB_RUN'}}));
  }finally{await app.close();if(previous===undefined)delete process.env.DATABASE_URL;else process.env.DATABASE_URL=previous;}
  await db.parentSchoolMembership.update({where:{parentId_schoolId:{parentId:p.id,schoolId:school.id}},data:{verificationStatus:'PENDING'}});await assert.rejects(()=>service.detail(parent,q.id));
 }finally{
  // Remove only fixture-owned records, in restrictive foreign-key order.
  await db.parentQueryMessage.deleteMany({where:{query:{schoolId:{in:schools}}}});await db.parentQuery.deleteMany({where:{schoolId:{in:schools}}});await db.dailyActivity.deleteMany({where:{schoolId:{in:schools}}});await db.studentParent.deleteMany({where:{parent:{userId:{in:users}}}});await db.studentEnrollment.deleteMany({where:{schoolId:{in:schools}}});await db.teacherAcademicAssignment.deleteMany({where:{schoolId:{in:schools}}});await db.section.deleteMany({where:{schoolId:{in:schools}}});await db.schoolClass.deleteMany({where:{schoolId:{in:schools}}});await db.school.deleteMany({where:{id:{in:schools}}});await db.user.deleteMany({where:{id:{in:users}}});await db.$disconnect();
 }
});
