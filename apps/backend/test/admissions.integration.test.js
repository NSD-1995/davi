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

test('PostgreSQL capacity policy, waitlist, approved partial allocation and concurrent final seat',{skip:process.env.ADMISSIONS_DB_TEST!=='1'},async()=>fixture(async f=>{
 const {db,school,year,schoolClass,sections,actor,allocation,crm,application}=f;
 const entries=[];
 for(let i=0;i<3;i++){
  const app=await crm.createApplication(school.id,actor.id,application('Capacity'+i));
  const approved=await crm.decision(school.id,actor.id,app.id,{version:1,decision:'APPROVED',reason:'Fixture application reviewed'});
  const joined=await crm.join(school.id,actor.id,app.id,{version:approved.version,status:'JOINED',admissionNumber:'CAP-'+i,joinedAt:'2026-10-19',reason:'Fixture joining confirmed',sectionId:null});
  entries.push(await db.studentEnrollment.findUnique({where:{id:joined.enrollmentId}}));
 }
 await allocation.saveCapacityPolicy(school.id,actor.id,{expectedPolicy:'{}',reason:'Fixture capacity policy',policy:{defaultCapacity:1,preference:'BALANCED_COUNT',nearFullPercent:90,rules:[],constraints:[]}});
 const plan={academicYearId:year.id,classId:schoolClass.id,sections:sections.map(s=>({id:s.id,key:s.id,name:s.name,capacity:1}))};
 const preview=await allocation.preview(school.id,plan);
 assert.equal(preview.assignments.length,2);assert.equal(preview.waitlist.length,1);
 await allocation.confirm(school.id,actor.id,{...plan,sections:preview.sections,expectedPolicy:preview.expectedPolicy,assignments:preview.assignments,waitlist:preview.waitlist,reason:'Approve available placements',confirmCreateSections:false});
 assert.equal((await allocation.list(school.id,{academicYearId:year.id,classId:schoolClass.id})).unassigned.length,1);
 assert.equal(await db.auditLog.count({where:{schoolId:school.id,action:'SECTION_ALLOCATION_APPROVED'}}),1);
 const placed=await db.studentEnrollment.findMany({where:{schoolId:school.id,sectionId:{not:null}}});
 await db.studentEnrollment.updateMany({where:{id:{in:placed.map(e=>e.id)}},data:{sectionId:null,version:{increment:1}}});
 const current=await db.studentEnrollment.findMany({where:{schoolId:school.id},orderBy:{id:'asc'}});
 const results=await Promise.allSettled(current.slice(0,2).map(e=>allocation.move(school.id,actor.id,{assignments:[{enrollmentId:e.id,version:e.version,sectionId:sections[0].id}],reason:'Competing final seat'})));
 assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
 assert.equal(await db.studentEnrollment.count({where:{schoolId:school.id,sectionId:sections[0].id,status:'ACTIVE'}}),1);
 await assert.rejects(allocation.saveCapacityPolicy(school.id,actor.id,{expectedPolicy:'{}',reason:'Stale policy attempt',policy:{defaultCapacity:2}}),/Policy changed/);
}));

test('PostgreSQL uploaded students enroll directly without enquiries and retries do not duplicate',{skip:process.env.ADMISSIONS_DB_TEST!=='1'},async()=>fixture(async f=>{
 const {db,school,year,schoolClass,actor,allocation,crm,application}=f;
 const {StudentIntakeService}=require('../dist/student-admissions/student-intake.service');
 const intake=new StudentIntakeService(db,crm,allocation,new StudentAdmissionsService(db));
 await db.section.deleteMany({where:{schoolId:school.id}});
 await db.schoolClass.update({where:{id:schoolClass.id},data:{academicGroup:'PRIMARY'}});
 await allocation.saveCapacityPolicy(school.id,actor.id,{expectedPolicy:'{}',reason:'Set group norm for intake',policy:{autoAssignOnJoin:true,rules:[{academicYearId:year.id,level:'ACADEMIC_LEVEL',target:'PRIMARY',maximum:2,reserved:0}]}});
 await db.school.update({where:{id:school.id},data:{shortName:'INTAKE'}});
 const rows=Array.from({length:5},(_,i)=>({firstName:'Imported'+i,lastName:'Fixture',className:schoolClass.name,parentName:'Upload Parent',mobile:f.mobile}));
 const input={academicYearId:year.id,rows};
 const preview=await intake.preview(school.id,input);assert.deepEqual(preview.errors,[]);assert.equal(preview.groups[0].sections.length,3);assert.deepEqual(preview.groups[0].distribution.map(s=>s.proposedTotal),[2,2,1]);
 assert.equal(await db.section.count({where:{schoolId:school.id}}),0);assert.equal(await db.admissionApplication.count({where:{schoolId:school.id}}),0);
 await assert.rejects(intake.confirm(school.id,actor.id,{...input,expectedPreview:preview.expectedPreview,reason:'Approve uploaded intake',approveSections:false}),/Approve/);
 await assert.rejects(intake.confirm(school.id,actor.id,{...input,expectedPreview:'0'.repeat(64),reason:'Stale intake',approveSections:true}),/fresh preview/);
 const imported=await intake.confirm(school.id,actor.id,{...input,expectedPreview:preview.expectedPreview,reason:'Approve uploaded intake',approveSections:true});assert.equal(imported.students,5);assert.equal(imported.newSections,3);
 assert.equal(await db.studentEnrollment.count({where:{schoolId:school.id}}),5);
 assert.equal(await db.admissionEnquiry.count({where:{schoolId:school.id}}),0);
 assert.equal(await db.admissionApplication.count({where:{schoolId:school.id}}),0);
 const replay=await intake.confirm(school.id,actor.id,{...input,expectedPreview:preview.expectedPreview,reason:'Repeated upload',approveSections:true});assert.equal(replay.reused,true);assert.equal(await db.studentEnrollment.count({where:{schoolId:school.id}}),5);
 const before=await db.studentEnrollment.findMany({where:{schoolId:school.id},select:{id:true,sectionId:true}});
 const pair=[];for(let i=0;i<2;i++){const app=await crm.createApplication(school.id,actor.id,application('FinalAuto'+i));pair.push(await crm.decision(school.id,actor.id,app.id,{version:1,decision:'APPROVED',reason:'Reviewed final seat application'}));}
 const join=(app,i)=>crm.join(school.id,actor.id,app.id,{version:app.version,status:'JOINED',admissionNumber:'AUTO-LAST-'+i,joinedAt:'2026-10-19',sectionId:null,reason:'Concurrent automatic allocation'});
 const results=await Promise.allSettled(pair.map(join));
 for(let i=0;i<results.length;i++)if(results[i].status==='rejected')await join(await db.admissionApplication.findUnique({where:{id:pair[i].id}}),i);
 assert.equal(await db.studentEnrollment.count({where:{schoolId:school.id,sectionId:{not:null}}}),6);
 assert.equal(await db.studentEnrollment.count({where:{schoolId:school.id,sectionId:null}}),1);
 for(const e of before)assert.equal((await db.studentEnrollment.findUnique({where:{id:e.id}})).sectionId,e.sectionId);
 assert.equal(await db.auditLog.count({where:{schoolId:school.id,action:'STUDENT_PLACEMENT_WAITLISTED'}}),1);
 const bad=await intake.preview(school.id,{academicYearId:year.id,rows:[{...rows[0],firstName:'Unknown',className:'Not a class'}]});assert.equal(bad.errors.length,1);
 await assert.rejects(intake.preview('another-school',input),/academic year/);
}));

test('PostgreSQL enquiry converts to enrollment with one admission confirmation and no prior decision',{skip:process.env.ADMISSIONS_DB_TEST!=='1'},async()=>fixture(async f=>{
 await f.db.school.update({where:{id:f.school.id},data:{shortName:'DAVI'}});
 await f.crm.saveSettings(f.school.id,f.actor.id,{requireSectionOnJoin:false,formTitle:'Admissions',formDescription:'',extraFields:[],requiredDocuments:['Birth certificate'],fees:[]});
 const enquiry=await f.crm.createEnquiry(f.school.id,f.actor.id,{academicYearId:f.year.id,classId:f.schoolClass.id,studentName:'New Fixture',parentName:'Parent Fixture',mobile:f.mobile,source:'WALK_IN',remarks:'Ready for admission'});
 const app=await f.crm.createApplication(f.school.id,f.actor.id,f.application('New',enquiry.id));assert.equal(app.decision,'UNDER_REVIEW');
 const request={version:app.version,joinedAt:new Date().toISOString().slice(0,10),sectionId:f.sections[0].id,reason:'Confirm admission from registered enquiry'};
 await assert.rejects(f.crm.confirmAdmission(f.school.id,f.actor.id,app.id,request),/Upload Birth certificate/);assert.equal(await f.db.studentEnrollment.count({where:{schoolId:f.school.id}}),0);assert.equal((await f.crm.application(f.school.id,app.id)).decision,'UNDER_REVIEW');
 await f.crm.saveSettings(f.school.id,f.actor.id,{requireSectionOnJoin:false,formTitle:'Admissions',formDescription:'',extraFields:[],requiredDocuments:[],fees:[]});
 const attempts=await Promise.allSettled([f.crm.confirmAdmission(f.school.id,f.actor.id,app.id,request),f.crm.confirmAdmission(f.school.id,f.actor.id,app.id,request)]);assert.equal(attempts.filter(a=>a.status==='fulfilled').length,1);assert.equal(await f.db.studentEnrollment.count({where:{schoolId:f.school.id}}),1);
 const enrollment=await f.db.studentEnrollment.findFirst({where:{schoolId:f.school.id}});assert.equal(enrollment.admissionNumber,'DAVI-000001');assert.equal((await f.crm.enquiry(f.school.id,enquiry.id)).status,'CONVERTED');assert.equal((await f.crm.list(f.school.id,'applications',{academicYearId:f.year.id,admissionState:'ADMITTED'})).total,1);assert.equal((await f.crm.list(f.school.id,'applications',{academicYearId:f.year.id,admissionState:'PENDING'})).total,0);
}));

test('PostgreSQL section roll generation is scoped, previewed, audited and rejects stale concurrent saves',{skip:process.env.ADMISSIONS_DB_TEST!=='1'},async()=>fixture(async f=>{
 const {SectionsService}=require('../dist/sections/sections.service');const service=new SectionsService(f.db),admissions=new StudentAdmissionsService(f.db);await f.db.section.update({where:{id:f.sections[0].id},data:{capacity:10}});
 const enrollments=[];for(const [i,name]of ['Zara','Alice','Ben'].entries()){const result=await admissions.create(f.school.id,{student:{firstName:name,lastName:'Fixture',admissionNumber:'ROLL-'+i},enrollment:{academicYearId:f.year.id,classId:f.schoolClass.id,sectionId:f.sections[0].id},parents:[{firstName:'Parent',mobile:f.mobile,isPrimary:true}]});enrollments.push(result.enrollment);}
 await f.db.studentEnrollment.updateMany({where:{id:{in:enrollments.map(e=>e.id)}},data:{rollNumber:null}});await f.db.studentEnrollment.update({where:{id:enrollments[0].id},data:{rollNumber:'7'}});
 const request={academicYearId:f.year.id};const plan=await service.rollNumbers(f.school.id,f.actor.id,f.sections[0].id,request);assert.equal(plan.changed,2);assert.deepEqual(plan.rows.map(r=>r.proposed),['8','9','7']);assert.equal((await f.db.studentEnrollment.findUnique({where:{id:enrollments[1].id}})).rollNumber,null);
 await assert.rejects(service.rollNumbers(f.school.id,f.actor.id,f.sections[0].id,{academicYearId:f.nextYear.id}),/not found/);await assert.rejects(service.rollNumbers('other-school',f.actor.id,f.sections[0].id,request),/permission/);
 const saves=await Promise.allSettled([1,2].map(()=>service.rollNumbers(f.school.id,f.actor.id,f.sections[0].id,{...request,expectedPreview:plan.expectedPreview},true)));assert.equal(saves.filter(r=>r.status==='fulfilled').length,1);assert.equal(await f.db.auditLog.count({where:{schoolId:f.school.id,action:'SECTION_ROLL_NUMBERS_GENERATED'}}),1);assert.equal((await service.rollNumbers(f.school.id,f.actor.id,f.sections[0].id,request)).changed,0);assert.equal((await f.db.studentEnrollment.findUnique({where:{id:enrollments[0].id}})).rollNumber,'7');
}));

test('PostgreSQL registration and section assignment save automatic or manual rolls and reject duplicates',{skip:process.env.ADMISSIONS_DB_TEST!=='1'},async()=>fixture(async f=>{
 const admissions=new StudentAdmissionsService(f.db);for(const section of f.sections)await f.db.section.update({where:{id:section.id},data:{capacity:10}});
 const create=(name,sectionId,rollNumber)=>admissions.create(f.school.id,{student:{firstName:name,lastName:'Fixture',admissionNumber:'ASSIGN-'+name},enrollment:{academicYearId:f.year.id,classId:f.schoolClass.id,sectionId,rollNumber},parents:[{firstName:'Parent',mobile:f.mobile,isPrimary:true}]});
 const a=await create('Alice',f.sections[0].id,'5');assert.equal(a.enrollment.rollNumber,'5');const b=await create('Ben',f.sections[0].id);assert.equal(b.enrollment.rollNumber,'6');await assert.rejects(create('Duplicate',f.sections[0].id,'05'),/already exists/);assert.equal(await f.db.studentEnrollment.count({where:{schoolId:f.school.id}}),2);
 const c=await create('Cara');assert.equal(c.enrollment.rollNumber,null);await f.allocation.move(f.school.id,f.actor.id,{assignments:[{enrollmentId:c.enrollment.id,version:c.enrollment.version,classId:f.schoolClass.id,sectionId:f.sections[0].id}],reason:'Assign section with automatic roll'});let current=await f.db.studentEnrollment.findUnique({where:{id:c.enrollment.id}});assert.equal(current.rollNumber,'7');
 await f.allocation.move(f.school.id,f.actor.id,{assignments:[{enrollmentId:current.id,version:current.version,classId:f.schoolClass.id,sectionId:f.sections[1].id,rollNumber:'12'}],reason:'Transfer and set reviewed roll'});current=await f.db.studentEnrollment.findUnique({where:{id:c.enrollment.id}});assert.equal(current.rollNumber,'12');
 await assert.rejects(f.allocation.move(f.school.id,f.actor.id,{assignments:[{enrollmentId:current.id,version:current.version,classId:f.schoolClass.id,sectionId:f.sections[0].id,rollNumber:'6'}],reason:'Reject duplicate roll on transfer'}),/already exists/);assert.equal((await f.db.studentEnrollment.findUnique({where:{id:c.enrollment.id}})).sectionId,f.sections[1].id);
}));
