require('reflect-metadata');
const test=require('node:test'),assert=require('node:assert/strict'),{randomUUID,randomInt}=require('node:crypto');
const {PrismaClient}=require('@prisma/client');
const {StudentAdmissionsService}=require('../dist/student-admissions/student-admissions.service');
const {AdmissionsCrmService}=require('../dist/student-admissions/admissions-crm.service');
const {EnrollmentAllocationService}=require('../dist/student-admissions/enrollment-allocation.service');
const {ClassWorkspaceService}=require('../dist/class-workspace/class-workspace.service');
const {AttendanceService}=require('../dist/attendance/attendance.service');
const {AdmissionsDocumentsService}=require('../dist/student-admissions/admissions-documents.service');
const {ExamsService}=require('../dist/exams/exams.service');

async function fixture(action){
  const db=new PrismaClient(),slug='admissions-fixture-'+randomUUID();let school;
  try{
    school=await db.school.create({data:{name:'Admission lifecycle fixture',slug}});
    const year=await db.academicYear.create({data:{schoolId:school.id,name:'Current',isCurrent:true,startDate:new Date('2026-04-01'),endDate:new Date('2027-03-31')}});
    const nextYear=await db.academicYear.create({data:{schoolId:school.id,name:'Next',startDate:new Date('2027-04-01'),endDate:new Date('2028-03-31')}});
    const schoolClass=await db.schoolClass.create({data:{schoolId:school.id,academicYearId:year.id,name:'LKG'}});
    const nextClass=await db.schoolClass.create({data:{schoolId:school.id,academicYearId:nextYear.id,name:'UKG'}});
    const sections=await Promise.all(['A','B'].map(name=>db.section.create({data:{schoolId:school.id,classId:schoolClass.id,name,capacity:1}})));
    const actor=await db.user.create({data:{schoolId:school.id,email:slug+'@fixture.invalid',passwordHash:'non-login-fixture',mustChangePassword:false,firstName:'Fixture',lastName:'Administrator'}});
    const role=await db.role.create({data:{schoolId:school.id,name:'Fixture admin',code:'SCHOOL_ADMIN'}});await db.userRole.create({data:{schoolId:school.id,userId:actor.id,roleId:role.id}});
    const crm=new AdmissionsCrmService(db,new StudentAdmissionsService(db)),allocation=new EnrollmentAllocationService(db);
    const mobile='9'+String(randomInt(100000000,999999999));
    const application=(name,enquiryId)=>({academicYearId:year.id,classId:schoolClass.id,...(enquiryId?{enquiryId}:{}),student:{firstName:name,lastName:'Fixture',dateOfBirth:'2020-01-01'},parents:[{firstName:'Parent',lastName:'Fixture',mobile,relationship:'GUARDIAN',isPrimary:true}]});
    await action({db,school,year,nextYear,schoolClass,nextClass,sections,actor,crm,allocation,mobile,application});
  }finally{
    if(school){const documents=await db.admissionDocument.findMany({where:{schoolId:school.id},select:{fileKey:true}});await db.$transaction(async tx=>{
      const enrollments=await tx.studentEnrollment.findMany({where:{schoolId:school.id},include:{student:true}});
      const parents=await tx.parentSchoolMembership.findMany({where:{schoolId:school.id},include:{parent:true}});
      await tx.admissionActivity.deleteMany({where:{schoolId:school.id}});await tx.admissionPayment.deleteMany({where:{schoolId:school.id}});await tx.admissionDocument.deleteMany({where:{schoolId:school.id}});await tx.admissionApplication.deleteMany({where:{schoolId:school.id}});await tx.admissionEnquiry.deleteMany({where:{schoolId:school.id}});
      await tx.enrollmentMovement.deleteMany({where:{schoolId:school.id}});await tx.studentAttendance.deleteMany({where:{schoolId:school.id}});await tx.studentMark.deleteMany({where:{enrollment:{schoolId:school.id}}});await tx.studentEnrollment.deleteMany({where:{schoolId:school.id}});
      await tx.student.deleteMany({where:{id:{in:enrollments.map(row=>row.studentId)}}});await tx.parentSchoolMembership.deleteMany({where:{schoolId:school.id}});await tx.parent.deleteMany({where:{id:{in:parents.map(row=>row.parentId)}}});
      await tx.user.deleteMany({where:{id:{in:[...enrollments.map(row=>row.student.userId),...parents.map(row=>row.parent.userId)]}}});
      await tx.examSubject.deleteMany({where:{exam:{schoolId:school.id}}});await tx.exam.deleteMany({where:{schoolId:school.id}});await tx.school.delete({where:{id:school.id}});
    },{timeout:30000});
    for(const document of documents){if(/^[a-f0-9-]{36}$/.test(document.fileKey))await require('node:fs/promises').unlink(require('node:path').resolve('private-uploads/admissions',document.fileKey)).catch(()=>{});}}
    await db.$disconnect();
  }
}

test('PostgreSQL admission lifecycle, verified fees, optional sections, allocation, historical swaps and promotion',{skip:process.env.ADMISSIONS_DB_TEST!=='1'},async()=>fixture(async f=>{
  const {db,school,year,nextYear,schoolClass,nextClass,sections,actor,crm,allocation,mobile,application}=f;
  await crm.saveSettings(school.id,actor.id,{requireSectionOnJoin:false,formTitle:'Fixture admissions',formDescription:'',extraFields:[],requiredDocuments:['Birth certificate'],fees:[{academicYearId:year.id,classIds:[schoolClass.id],amountMinor:10000,mandatory:true,methods:['UPI'],refundPolicy:'Authorized refunds only',waiverAllowed:true,waiverEligibility:'Authorized financial assistance'}]});
  const enquiryData={studentName:'Alice Fixture',parentName:'Parent',mobile,academicYearId:year.id,classId:schoolClass.id,source:'PHONE'};
  const enquiry=await crm.createEnquiry(school.id,actor.id,enquiryData);
  const duplicate=await crm.createEnquiry(school.id,actor.id,{...enquiryData,studentName:'ALICE FIXTURE'});assert.equal(duplicate.id,enquiry.id);assert.equal(duplicate.duplicate,true);
  await crm.followup(school.id,actor.id,enquiry.id,{version:1,occurredAt:new Date(Date.now()-5000).toISOString(),method:'PHONE',remarks:'Parent interested in admission',outcome:'Interested',status:'INTERESTED',nextFollowUpAt:new Date(Date.now()+86400000).toISOString(),assignedStaffId:null});
  assert.equal((await crm.enquiry(school.id,enquiry.id)).activities.length,3);
  const app=await crm.createApplication(school.id,actor.id,application('Alice',enquiry.id));
  const approved=await crm.decision(school.id,actor.id,app.id,{version:1,decision:'APPROVED',reason:'Application reviewed'});
  const joining={version:approved.version,status:'JOINED',admissionNumber:'ADM-ALICE',joinedAt:'2026-10-18',reason:'Parent confirmed joining',sectionId:null};
  await assert.rejects(crm.join(school.id,actor.id,app.id,joining),/Upload Birth certificate/);
  const documents=new AdmissionsDocumentsService(db,crm);
  const document=await documents.upload(school.id,actor.id,app.id,'Birth certificate',{buffer:Buffer.from('%PDF-1.4\nFixture document'),originalname:'birth.pdf'});
  assert.equal((await documents.download(school.id,app.id,document.id)).buffer.toString(),'%PDF-1.4\nFixture document');
  await assert.rejects(documents.download('foreign-school',app.id,document.id),/not found/);
  await assert.rejects(crm.join(school.id,actor.id,app.id,joining),/mandatory application fee/);
  assert.equal(await db.studentEnrollment.count({where:{schoolId:school.id}}),0);
  await assert.rejects(crm.recordPayment(school.id,actor.id,app.id,{amountMinor:10000,method:'UPI',reference:slug(),status:'VERIFIED'}),/Unrecognized/);
  const payment=await crm.recordPayment(school.id,actor.id,app.id,{amountMinor:10000,method:'UPI',reference:slug()});
  const verified=await crm.verifyPayment(school.id,actor.id,payment.id,{version:1,status:'VERIFIED',reason:'Matched bank credit'});assert.ok(verified.receiptNumber);
  await assert.rejects(crm.verifyPayment(school.id,actor.id,payment.id,{version:1,status:'VERIFIED',reason:'Repeated request'}),/changed/);
  const joined=await crm.join(school.id,actor.id,app.id,joining);assert.ok(joined.enrollmentId);
  const alice=await db.studentEnrollment.findUnique({where:{id:joined.enrollmentId}});assert.equal(alice.sectionId,null);
  await assert.rejects(crm.join(school.id,actor.id,app.id,joining),/changed|already/);
  const workspace=(await new ClassWorkspaceService(db).workspaces(school.id,year.id)).find(row=>row.id===schoolClass.id);assert.equal(workspace.studentCount,1);assert.equal(workspace.unassignedStudentCount,1);
  const bobApp=await crm.createApplication(school.id,actor.id,application('Bob'));
  let bobApproved=await crm.decision(school.id,actor.id,bobApp.id,{version:1,decision:'APPROVED',reason:'Application reviewed'});
  const notJoined=await crm.join(school.id,actor.id,bobApp.id,{version:bobApproved.version,status:'NOT_JOINED',reason:'Family postponed joining'});assert.equal(notJoined.enrollmentId,null);
  await crm.waive(school.id,actor.id,bobApp.id,{version:notJoined.version,reason:'Approved financial assistance'});
  await documents.upload(school.id,actor.id,bobApp.id,'Birth certificate',{buffer:Buffer.from('%PDF-1.4 Bob fixture'),originalname:'birth.pdf'});
  const bobReady=await crm.application(school.id,bobApp.id);
  const bobJoined=await crm.join(school.id,actor.id,bobApp.id,{version:bobReady.version,status:'JOINED',admissionNumber:'ADM-BOB',joinedAt:'2026-10-18',reason:'Family confirmed joining'});
  const plan={academicYearId:year.id,classId:schoolClass.id,sections:sections.map(row=>({id:row.id,key:row.id,name:row.name,capacity:1}))};
  const preview=await allocation.preview(school.id,plan);assert.equal(preview.assignments.length,2);
  await assert.rejects(allocation.confirm(school.id,actor.id,{...plan,sections:preview.sections,assignments:preview.assignments.map(row=>({...row,sectionId:sections[0].id})),reason:'Invalid overcrowded plan',confirmCreateSections:true}),/capacity/);
  await allocation.confirm(school.id,actor.id,{...plan,sections:preview.sections,assignments:preview.assignments,reason:'Balanced section allocation',confirmCreateSections:true});
  const extraPlan={...plan,sections:[...plan.sections,{key:'new-C',name:'C',capacity:1}]};
  const extraPreview=await allocation.preview(school.id,extraPlan);assert.equal(await db.section.count({where:{classId:schoolClass.id}}),2);
  await assert.rejects(allocation.confirm(school.id,actor.id,{...extraPlan,sections:extraPreview.sections,assignments:extraPreview.assignments,reason:'Create reviewed section',confirmCreateSections:false}),/Explicitly/);
  await allocation.confirm(school.id,actor.id,{...extraPlan,sections:extraPreview.sections,assignments:extraPreview.assignments,reason:'Create reviewed section',confirmCreateSections:true});assert.equal(await db.section.count({where:{classId:schoolClass.id}}),3);
  const before=await db.studentEnrollment.findMany({where:{schoolId:school.id},orderBy:{admissionNumber:'asc'}});const [first,second]=before;
  const subject=await db.subject.create({data:{schoolId:school.id,name:'English',code:'ENG'}}),exam=await db.exam.create({data:{schoolId:school.id,academicYearId:year.id,name:'Term assessment',type:'TERM'}}),examSubject=await db.examSubject.create({data:{examId:exam.id,classId:schoolClass.id,subjectId:subject.id,maximumMarks:100,passingMarks:40}});
  const attendance=await db.studentAttendance.create({data:{schoolId:school.id,enrollmentId:first.id,date:new Date('2026-10-17'),status:'PRESENT',markedById:actor.id}});
  await db.studentMark.create({data:{examSubjectId:examSubject.id,enrollmentId:first.id,marksObtained:80}});
  await allocation.move(school.id,actor.id,{assignments:[{enrollmentId:first.id,version:first.version,sectionId:second.sectionId},{enrollmentId:second.id,version:second.version,sectionId:first.sectionId}],reason:'Authorized section swap'});
  assert.equal((await db.studentAttendance.findUnique({where:{id:attendance.id}})).sectionIdSnapshot,first.sectionId);
  const historic=await new AttendanceService(db).listStudents(school.id,'2026-10-17',schoolClass.id,first.sectionId);assert.equal(historic[0].enrollment.section.id,first.sectionId);
  const marks=await new ExamsService(db).results(school.id,exam.id,schoolClass.id);assert.equal(marks.results[0].enrollment.section.id,first.sectionId);
  const bobCurrent=await db.studentEnrollment.findUnique({where:{id:bobJoined.enrollmentId}});
  await assert.rejects(allocation.move(school.id,actor.id,{assignments:[{enrollmentId:bobCurrent.id,version:bobCurrent.version,sectionId:randomUUID()}],reason:'Invalid foreign destination'}),/Target section/);
  const transferredClass=await db.schoolClass.create({data:{schoolId:school.id,academicYearId:year.id,name:'Other class'}}),transferredSection=await db.section.create({data:{schoolId:school.id,classId:transferredClass.id,name:'A',capacity:1}});
  await allocation.move(school.id,actor.id,{assignments:[{enrollmentId:bobCurrent.id,version:bobCurrent.version,classId:transferredClass.id,sectionId:transferredSection.id}],reason:'Authorized same-school class transfer'});
  assert.equal((await db.studentEnrollment.findUnique({where:{id:bobCurrent.id}})).classId,transferredClass.id);
  const current=await db.studentEnrollment.findUnique({where:{id:alice.id}});
  await allocation.promote(school.id,actor.id,{enrollmentIds:[{id:alice.id,version:current.version}],academicYearId:nextYear.id,classId:nextClass.id,sectionId:null,reason:'Annual promotion approved'});
  const nextEnrollment=await db.studentEnrollment.findUnique({where:{studentId_schoolId_academicYearId:{studentId:alice.studentId,schoolId:school.id,academicYearId:nextYear.id}}});assert.equal(nextEnrollment.sectionId,null);assert.equal(nextEnrollment.admissionNumber,'ADM-ALICE');
  assert.equal((await db.studentEnrollment.findUnique({where:{id:alice.id}})).status,'PROMOTED');assert.equal(await db.studentMark.count({where:{enrollmentId:alice.id}}),1);
  await assert.rejects(allocation.list('foreign-school',{academicYearId:year.id,classId:schoolClass.id}),/not found/);
  await assert.rejects(crm.application('foreign-school',app.id),/not found/);
  const summary=await crm.dashboard(school.id,{academicYearId:year.id});assert.equal(summary.joined,2);assert.equal(summary.applicationFeesCollectedMinor,10000);
}));
const slug=()=>randomUUID();

test('PostgreSQL authenticated HTTP admissions routes enforce tenant permissions and keep documents private',{skip:process.env.ADMISSIONS_DB_TEST!=='1'},async()=>fixture(async({school,year,actor})=>{
  const {NestFactory}=require('@nestjs/core'),{JwtService}=require('@nestjs/jwt'),{AppModule}=require('../dist/app.module');
  const app=await NestFactory.create(AppModule,{logger:false});
  try{
    app.setGlobalPrefix('api/v1');await app.listen(0,'127.0.0.1');
    const base=await app.getUrl();
    const token=new JwtService({secret:process.env.JWT_SECRET||'davi-super-secret-key'}).sign({sub:actor.id,id:actor.id,schoolId:school.id});
    assert.equal((await fetch(base+'/api/v1/admissions/lookups')).status,401);
    const response=await fetch(base+'/api/v1/admissions/lookups',{headers:{Authorization:'Bearer '+token}});assert.equal(response.status,200);const lookups=await response.json();assert.equal(lookups.school.name,'Admission lifecycle fixture');assert.ok(lookups.years.every(row=>row.schoolId===school.id));
    assert.equal((await fetch(base+'/api/v1/admissions/applications/'+randomUUID(),{headers:{Authorization:'Bearer '+token}})).status,404);
    const rejected=await fetch(base+'/api/v1/admissions/enquiries',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({schoolId:'foreign',academicYearId:year.id})});assert.equal(rejected.status,400);
  }finally{await app.close();}
}));

test('PostgreSQL concurrent joining and last-seat assignment never double-enroll or overfill',{skip:process.env.ADMISSIONS_DB_TEST!=='1'},async()=>fixture(async({db,school,year,schoolClass,sections,actor,crm,allocation,application})=>{
  const app=await crm.createApplication(school.id,actor.id,application('Concurrent'));
  const approved=await crm.decision(school.id,actor.id,app.id,{version:1,decision:'APPROVED',reason:'Reviewed application'});
  const body={version:approved.version,status:'JOINED',admissionNumber:'ADM-CONCURRENT',joinedAt:'2026-10-18',reason:'Confirmed joining'};
  const joined=await Promise.allSettled([crm.join(school.id,actor.id,app.id,body),crm.join(school.id,actor.id,app.id,body)]);assert.equal(joined.filter(row=>row.status==='fulfilled').length,1);
  const otherApp=await crm.createApplication(school.id,actor.id,application('Other'));
  const otherApproved=await crm.decision(school.id,actor.id,otherApp.id,{version:1,decision:'APPROVED',reason:'Reviewed application'});await crm.join(school.id,actor.id,otherApp.id,{...body,version:otherApproved.version,admissionNumber:'ADM-OTHER'});
  const enrollments=await db.studentEnrollment.findMany({where:{schoolId:school.id}});
  const results=await Promise.allSettled(enrollments.map(row=>allocation.move(school.id,actor.id,{assignments:[{enrollmentId:row.id,version:row.version,sectionId:sections[0].id}],reason:'Assign last available seat'})));
  assert.equal(results.filter(row=>row.status==='fulfilled').length,1,JSON.stringify({results,rows:await db.studentEnrollment.findMany({where:{schoolId:school.id},select:{id:true,sectionId:true,version:true}})}));assert.equal(await db.studentEnrollment.count({where:{schoolId:school.id,sectionId:sections[0].id,status:'ACTIVE'}}),1);
}));
