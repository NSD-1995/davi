require('reflect-metadata');
const test=require('node:test'),assert=require('node:assert/strict'),{randomUUID}=require('node:crypto'),{PrismaClient}=require('@prisma/client');
const {StaffPunchService}=require('../dist/attendance/staff-punch.service');
const {StaffAttendanceService}=require('../dist/attendance/staff-attendance.service');
const {SchoolOperationsService}=require('../dist/attendance/school-operations.service');
const {OperationsAccessService}=require('../dist/auth/operations-access.service');
test('PostgreSQL: concurrent leave approvals cannot overspend a shared balance',{skip:process.env.OPERATIONS_DB_TEST!=='1'},async()=>{
 const db=new PrismaClient();let school;
 try{
  const fixture=await db.$transaction(async tx=>{
   school=await tx.school.create({data:{name:'Leave race fixture',slug:'leave-race-'+randomUUID()}});
   const admin=await tx.user.create({data:{schoolId:school.id,email:'admin@race.invalid',passwordHash:'fixture',firstName:'Admin',lastName:'Race'}}),user=await tx.user.create({data:{schoolId:school.id,email:'staff@race.invalid',passwordHash:'fixture',firstName:'Staff',lastName:'Race'}});
   const role=await tx.role.create({data:{schoolId:school.id,code:'SCHOOL_ADMIN',name:'Admin'}});await tx.userRole.create({data:{schoolId:school.id,userId:admin.id,roleId:role.id}});
   const staff=await tx.staff.create({data:{schoolId:school.id,userId:user.id,employeeId:'RACE'}});
   await tx.schoolSetting.create({data:{schoolId:school.id,timezone:'UTC',operationsPolicy:{leaveTypes:['Sick'],workingDays:[1,2,3,4,5,6,7]}}});
   await tx.staffLeaveBalance.create({data:{schoolId:school.id,staffId:staff.id,leaveType:'Sick',year:2026,periodKey:'CALENDAR:2026',entitlement:1}});
   const requests=[];for(const date of ['2026-10-19','2026-10-20'])requests.push(await tx.staffLeaveRequest.create({data:{schoolId:school.id,staffId:staff.id,leaveType:'Sick',startDate:new Date(date),endDate:new Date(date),reason:'Test request'}}));
   return{admin,staff,requests};
  });
  const access=new OperationsAccessService(db),coverage={policy:async()=>({timeZone:'UTC'}),reconcile:async()=>({})},attendance=new StaffAttendanceService(db,access,coverage),ops=new SchoolOperationsService(db,access,attendance,coverage);
  await db.schoolSetting.update({where:{schoolId:school.id},data:{operationsPolicy:{leaveTypes:['Sick'],workingDays:[1,2,3,4,5,6,7],attendanceMode:'BOTH',selfAttendanceEnabled:true}}});
  const punches=new StaffPunchService(db,access,attendance,coverage),now=new Date('2026-10-19T09:00:00Z');
  const punched=await Promise.allSettled([punches.punch(school.id,fixture.staff.userId,'CHECK_IN',{},now),punches.punch(school.id,fixture.staff.userId,'CHECK_IN',{},now)]);
  assert.ok(punched.some(r=>r.status==='fulfilled'));assert.equal(await db.attendancePunch.count({where:{schoolId:school.id}}),1);
  await punches.punch(school.id,fixture.staff.userId,'CHECK_IN',{},now);assert.equal(await db.attendancePunch.count({where:{schoolId:school.id}}),1);
  const results=await Promise.allSettled(fixture.requests.map(r=>ops.decideLeave(school.id,fixture.admin.id,r.id,{status:'APPROVED',reason:'Authorized'})));
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(results.find(r=>r.status==='rejected').reason.getStatus(),409);
  const approved=await db.staffLeaveRequest.findFirst({where:{schoolId:school.id,status:'APPROVED'}});
  await ops.decideLeave(school.id,fixture.admin.id,approved.id,{status:'APPROVED',reason:'Retry'});
  assert.equal((await db.staffLeaveBalance.findFirst({where:{schoolId:school.id}})).used,1);assert.equal(await db.leaveLedger.count({where:{schoolId:school.id,kind:'DEDUCTION'}}),1);
  await ops.decideLeave(school.id,fixture.admin.id,approved.id,{status:'CANCELLED',reason:'Withdrawn'});await ops.decideLeave(school.id,fixture.admin.id,approved.id,{status:'CANCELLED',reason:'Retry'});
  assert.equal((await db.staffLeaveBalance.findFirst({where:{schoolId:school.id}})).used,0);assert.equal(await db.leaveLedger.count({where:{schoolId:school.id,kind:'REFUND'}}),1);
 }finally{if(school){await db.leaveLedger.deleteMany({where:{schoolId:school.id}});await db.school.delete({where:{id:school.id}});}await db.$disconnect();}
});
