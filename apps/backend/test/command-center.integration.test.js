require('reflect-metadata');
const test=require('node:test'),assert=require('node:assert/strict'),{randomUUID}=require('node:crypto');
const {Module}=require('@nestjs/common'),{NestFactory}=require('@nestjs/core');
const {PrismaModule}=require('../dist/prisma/prisma.module'),{PrismaService}=require('../dist/prisma/prisma.service'),{AuthModule}=require('../dist/auth/auth.module'),{DashboardModule}=require('../dist/dashboard/dashboard.module'),{DashboardCommandService}=require('../dist/dashboard/dashboard-command.service');
test('real database and module wiring: existing school, new school and foreign-year isolation',{skip:process.env.COMMAND_CENTER_INTEGRATION!=='1',timeout:60000},async()=>{
 class VerificationModule{};Module({imports:[PrismaModule,AuthModule,DashboardModule]})(VerificationModule);
 const app=await NestFactory.createApplicationContext(VerificationModule,{logger:false}),db=app.get(PrismaService),service=app.get(DashboardCommandService);let synthetic;
 try {
  const schools=await db.school.findMany({where:{name:{equals:'kidzee',mode:'insensitive'}},select:{id:true}});assert.equal(schools.length,1);
  const schoolId=schools[0].id,admin=await db.user.findFirst({where:{schoolId,status:'ACTIVE',roles:{some:{role:{code:'SCHOOL_ADMIN',isActive:true}}}},select:{id:true}}),year=await db.academicYear.findFirst({where:{schoolId,isCurrent:true}});assert.ok(admin);assert.ok(year);
  const before=await db.timetablePlan.count({where:{schoolId}}),started=Date.now(),result=await service.get(schoolId,admin.id,year.id);
  assert.equal(result.school.id,schoolId);assert.equal(result.academicYear.id,year.id);assert.deepEqual(result.errors,{});assert.ok(result.clock.timeZone);assert.equal(result.setup.total,7);assert.equal(typeof result.counts.students,'number');assert.ok(result.attendance);assert.ok(result.attendance.sections.every(row=>Number.isInteger(row.recorded)));assert.equal(await db.timetablePlan.count({where:{schoolId}}),before);
  console.log('Current school dashboard read-only aggregation: '+(Date.now()-started)+' ms; '+result.attendance.sections.length+' sections checked.');
  synthetic=await db.school.create({data:{name:'Synthetic Command Center Test',slug:'command-center-test-'+randomUUID()}});await db.schoolSetting.create({data:{schoolId:synthetic.id,timezone:'Asia/Kolkata'}});
  const role=await db.role.create({data:{schoolId:synthetic.id,name:'Synthetic Admin',code:'SCHOOL_ADMIN',isSystem:true}}),user=await db.user.create({data:{schoolId:synthetic.id,email:randomUUID()+'@invalid.example',passwordHash:'unusable-test-only',firstName:'Synthetic',lastName:'Admin',roles:{create:{schoolId:synthetic.id,roleId:role.id}}}});
  const blank=await service.get(synthetic.id,user.id);assert.equal(blank.academicYear,null);assert.equal(blank.setup.complete,false);assert.ok(blank.setup.outstanding>0);assert.equal(blank.attendance,null);assert.equal(blank.actions.length,0);assert.deepEqual(blank.errors,{});
  await assert.rejects(()=>service.get(synthetic.id,user.id,year.id),/outside your school/);
 } finally {if(synthetic){const target=await db.school.findUnique({where:{id:synthetic.id},select:{slug:true}});assert.ok(target?.slug.startsWith('command-center-test-'));await db.school.delete({where:{id:synthetic.id}});}await app.close();}
});
