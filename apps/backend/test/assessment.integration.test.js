require('reflect-metadata');
const test=require('node:test'),assert=require('node:assert/strict'),{randomUUID}=require('node:crypto');
const {PrismaClient}=require('@prisma/client'),{AssessmentService}=require('../dist/exams/assessment.service'),{assessmentDefaults}=require('../dist/exams/assessment-rules'),{assessmentPdf}=require('../dist/exams/assessment-pdf');
test('PostgreSQL unified assessment: marks, observations, review, publication, parent access, corrections and annual history',{skip:process.env.ASSESSMENT_DB_TEST!=='1',timeout:60000},async()=>{
 const db=new PrismaClient(),rollback=new Error('ROLLBACK_ASSESSMENT_FIXTURE');let completed=false;
 try{await db.$transaction(async tx=>{
  const client=new Proxy(tx,{get(target,key){if(key==='$transaction')return fn=>fn(client);return Reflect.get(target,key);}}),service=new AssessmentService(client);
  const school=await tx.school.create({data:{name:'Assessment Fixture School',slug:'assessment-'+randomUUID()}}),other=await tx.school.create({data:{name:'Other',slug:'other-'+randomUUID()}});
  const year=await tx.academicYear.create({data:{schoolId:school.id,name:'2026-2027'}}),nextYear=await tx.academicYear.create({data:{schoolId:school.id,name:'2027-2028'}});
  const c=await tx.schoolClass.create({data:{schoolId:school.id,academicYearId:year.id,name:'Class 3',academicGroup:'PRIMARY'}}),a=await tx.section.create({data:{schoolId:school.id,classId:c.id,name:'A'}}),b=await tx.section.create({data:{schoolId:school.id,classId:c.id,name:'B'}});
  const createUser=async(name)=>tx.user.create({data:{schoolId:school.id,email:randomUUID()+'@fixture.invalid',passwordHash:'fixture-only',firstName:name,lastName:'Fixture',mustChangePassword:false}});
  const admin=await createUser('Admin'),parentUser=await createUser('Parent'),teacherUser=await createUser('Teacher');
  const role=await tx.role.create({data:{schoolId:school.id,name:'Assessment fixture admin',code:'SCHOOL_ADMIN'}});await tx.userRole.create({data:{schoolId:school.id,userId:admin.id,roleId:role.id}});const user={id:admin.id,schoolId:school.id};
  const students=[];for(const name of ['Alice','Bob']){const u=await createUser(name),student=await tx.student.create({data:{userId:u.id,studentCode:randomUUID()}});students.push(await tx.studentEnrollment.create({data:{schoolId:school.id,academicYearId:year.id,classId:c.id,sectionId:a.id,studentId:student.id,admissionNumber:name}}));}
  const parent=await tx.parent.create({data:{userId:parentUser.id}});await tx.parentSchoolMembership.create({data:{parentId:parent.id,schoolId:school.id,parentCode:'P1',verificationStatus:'VERIFIED'}});await tx.studentParent.create({data:{parentId:parent.id,studentId:students[0].studentId,canViewAcademics:true}});
  const math=await tx.subject.create({data:{schoolId:school.id,name:'Mathematics',code:'MATH'}});await tx.classSubject.create({data:{schoolId:school.id,academicYearId:year.id,classId:c.id,subjectId:math.id}});
  const scope={academicYearId:year.id,classId:c.id,sectionId:a.id};const pattern={type:'MARKS',terms:[{key:'T1',label:'Term 1'},{key:'ANNUAL',label:'Annual',annual:true}],ratings:assessmentDefaults.ratings,components:[{key:'I',label:'Internal',maximum:20,weight:20},{key:'E',label:'Exam',maximum:80,weight:80}],grades:[{label:'A',minimum:80},{label:'B',minimum:0}],passPercent:40};
  const p=await service.savePattern(user,{academicYearId:year.id,scopeKey:'GROUP:PRIMARY',name:'20+80',config:pattern});
  const exam=await service.create(user,{...scope,name:'Term 1',termKey:'T1'});assert.equal(exam.assessmentPatternId,p.id);let detail=await service.detail(user,exam.id);const subject=detail.exam.subjects[0];
  await assert.rejects(service.detail({...user,schoolId:other.id},exam.id));
  const records=[{enrollmentId:students[0].id,scores:{I:18,E:64},remarks:'Consistent work'},{enrollmentId:students[1].id,state:'ABSENT'}];
  const preview=await service.marks(user,exam.id,{revision:1,examSubjectId:subject.id,records},true);assert.equal(preview.rows[0].percentage,82);assert.equal(await tx.studentMark.count({where:{examSubjectId:subject.id}}),0);
  await assert.rejects(service.marks(user,exam.id,{revision:1,examSubjectId:subject.id,records:[records[0],records[0]]}),/Duplicate/);
  const invalid=await service.marks(user,exam.id,{revision:1,examSubjectId:subject.id,records:[{...records[0],scores:{I:21,E:64}}]},true);assert.match(invalid.rows[0].error,/between/);
  await service.marks(user,exam.id,{revision:1,examSubjectId:subject.id,records});await assert.rejects(service.marks(user,exam.id,{revision:1,examSubjectId:subject.id,records}),/changed/);
  // A move does not rewrite the captured assessment location or roster.
  await tx.studentEnrollment.update({where:{id:students[0].id},data:{sectionId:b.id}});
  let rev=2;for(const action of ['PUBLISH']){await service.transition(user,exam.id,{revision:rev++,action,reason:'Fixture reviewed decision'});}
  detail=await service.detail(user,exam.id);assert.equal(detail.exam.status,'PUBLISHED');assert.equal(detail.reports.length,2);
  await assert.rejects(service.marks(user,exam.id,{revision:rev,examSubjectId:subject.id,records}),/locked/);
  const reports=await service.parentReports({id:parentUser.id},students[0].id);assert.equal(reports.length,1);assert.equal(reports[0].snapshot.subjects[0].percentage,82);assert.equal(reports[0].snapshot.student.sectionName,'A');
  await assert.rejects(service.parentReports({id:parentUser.id},students[1].id),/cannot view/);
  assert.ok((await assessmentPdf(reports[0].snapshot)).subarray(0,5).toString()==='%PDF-');
  await service.transition(user,exam.id,{revision:rev++,action:'REOPEN',reason:'Correct verified transcription'});await service.marks(user,exam.id,{revision:rev++,examSubjectId:subject.id,records:[{...records[0],scores:{I:20,E:80}}]});for(const action of ['SUBMIT','REVIEW','APPROVE','PUBLISH'])await service.transition(user,exam.id,{revision:rev++,action,reason:'Fixture correction reviewed'});
  const versions=await service.parentReports({id:parentUser.id},students[0].id);assert.equal(versions.length,2);assert.equal(versions[0].snapshot.subjects[0].percentage,100);assert.equal(versions[1].snapshot.subjects[0].percentage,82);
  // New default versions do not change the assessment configuration.
  await service.savePattern(user,{academicYearId:year.id,scopeKey:'GROUP:PRIMARY',name:'Updated norm',config:{...pattern,passPercent:60}});assert.equal((await service.detail(user,exam.id)).exam.assessmentConfig.passPercent,40);
  // Restore location so annual roster includes the same child, then freeze annual reports.
  await tx.studentEnrollment.update({where:{id:students[0].id},data:{sectionId:a.id}});
  const annual=await service.create(user,{...scope,name:'Annual',termKey:'ANNUAL'});let ar=1;for(const action of ['SUBMIT','REVIEW','APPROVE','PUBLISH'])await service.transition(user,annual.id,{revision:ar++,action,reason:'Annual review'});const annualReports=await service.parentReports({id:parentUser.id},students[0].id);assert.equal(annualReports[0].snapshot.terms.length,1);
  // Montessori retains multiple observations, with no manufactured numeric results.
  const mc=await tx.schoolClass.create({data:{schoolId:school.id,academicYearId:year.id,name:'LKG',academicGroup:'MONTESSORI'}}),ms=await tx.section.create({data:{schoolId:school.id,classId:mc.id,name:'A'}});
  await tx.studentEnrollment.update({where:{id:students[0].id},data:{classId:mc.id,sectionId:ms.id}});
  const mp=await service.savePattern(user,{academicYearId:year.id,scopeKey:'CLASS:'+mc.id,name:'Montessori',config:{type:'COMPETENCY',terms:[{key:'T1',label:'Term 1'}],ratings:assessmentDefaults.ratings,competencies:[{key:'POUR',label:'Pouring',domain:'Practical life',outcome:'Pour independently',material:'Jug'}]}});
  const obs=await service.create(user,{academicYearId:year.id,classId:mc.id,sectionId:ms.id,name:'Montessori term',termKey:'T1',patternId:mp.id});
  const observation={enrollmentId:students[0].id,competencyKey:'POUR',rating:'EMERGING',observedOn:'2026-01-01',remarks:'Pours with guidance',requestKey:randomUUID()};await service.observations(user,obs.id,{revision:1,records:[observation]});await service.observations(user,obs.id,{revision:2,records:[{...observation,rating:'INDEPENDENT',observedOn:'2026-01-02',remarks:'Pours independently',requestKey:randomUUID()}]});
  const {AssessmentAiService}=require('../dist/exams/assessment-ai.service');let paidCalls=0;
  const ai=new AssessmentAiService(client,service,{structured:async(_version,_instructions,input)=>{paidCalls++;return {output:{title:'Draft comment',text:'The recorded observations show increasing independence.',evidenceIds:input.evidence.map(e=>e.id)},inputTokens:50,outputTokens:25};}});
  await assert.rejects(ai.generate(user,obs.id,{kind:'COMMENT',enrollmentId:students[0].id,evidenceReviewed:true}),/disabled/);
  await ai.savePolicy(user,{enabled:true,monthlyTokenBudget:100000,requestsPerMinute:1});
  const draft=await ai.generate(user,obs.id,{kind:'COMMENT',enrollmentId:students[0].id,evidenceReviewed:true});assert.equal(draft.status,'DRAFT');
  const cached=await ai.generate(user,obs.id,{kind:'COMMENT',enrollmentId:students[0].id,evidenceReviewed:true});assert.equal(cached.cached,true);assert.equal(paidCalls,1);
  await assert.rejects(ai.generate(user,obs.id,{kind:'RUBRIC',evidenceReviewed:true}),/rate limit/);
  await ai.savePolicy(user,{enabled:true,monthlyTokenBudget:1,requestsPerMinute:30});await assert.rejects(ai.generate(user,obs.id,{kind:'RUBRIC',evidenceReviewed:true}),/budget/);
  await ai.review(user,obs.id,draft.id,{revision:3,approved:true,output:draft.output});
  let or=4;for(const action of ['SUBMIT','REVIEW','APPROVE','PUBLISH'])await service.transition(user,obs.id,{revision:or++,action,reason:'Development reviewed'});const od=await service.detail(user,obs.id);assert.equal(od.observations.length,2);const rr=await service.report(user,od.reports[0].id);assert.equal(rr.snapshot.competencies[0].rating,'Independent');assert.match(rr.snapshot.teacherComment,/increasing independence/);assert.equal(rr.snapshot.competencies[0].history.length,2);assert.deepEqual(rr.snapshot.subjects,[]);assert.ok(!JSON.stringify(rr.snapshot).includes('percentage'));
  // Promotions use a new enrollment; published old-year reports remain tied to the old one.
  const nc=await tx.schoolClass.create({data:{schoolId:school.id,academicYearId:nextYear.id,name:'UKG'}});await tx.studentEnrollment.create({data:{schoolId:school.id,academicYearId:nextYear.id,classId:nc.id,studentId:students[0].studentId,admissionNumber:'Alice'}});assert.equal((await service.report(user,rr.id)).academicYearId,year.id);
  const staff=await tx.staff.create({data:{schoolId:school.id,userId:teacherUser.id,employeeId:'T1'}}),teacher=await tx.teacher.create({data:{schoolId:school.id,userId:teacherUser.id,teacherCode:'T1'}}),tr=await tx.role.create({data:{schoolId:school.id,name:'Fixture teacher',code:'TEACHER'}});await tx.userRole.create({data:{schoolId:school.id,userId:teacherUser.id,roleId:tr.id}});for(const code of ['MARKS_UPDATE','MARKS_VIEW']){const permission=await tx.permission.findUnique({where:{code}});await tx.rolePermission.create({data:{roleId:tr.id,permissionId:permission.id}});}
  await assert.rejects(service.detail({id:teacherUser.id,schoolId:school.id},obs.id),/not assigned/);await tx.teacherAcademicAssignment.create({data:{schoolId:school.id,academicYearId:year.id,classId:mc.id,sectionId:ms.id,teacherId:teacher.id,isClassTeacher:true}});assert.equal((await service.detail({id:teacherUser.id,schoolId:school.id},obs.id)).exam.id,obs.id);await assert.rejects(service.transition({id:teacherUser.id,schoolId:school.id},obs.id,{revision:or,action:'REOPEN',reason:'Not authorized'}),/permission/);
  const science=await tx.subject.create({data:{schoolId:school.id,name:'Science',code:'SCI'}});await tx.classSubject.create({data:{schoolId:school.id,academicYearId:year.id,classId:c.id,subjectId:science.id}});
  await tx.teacherAcademicAssignment.create({data:{schoolId:school.id,academicYearId:year.id,classId:c.id,sectionId:a.id,subjectId:math.id,teacherId:teacher.id}});
  const scopedExam=await service.create(user,{...scope,name:'Subject authorization fixture',termKey:'T1'});const scopedDetail=await service.detail(user,scopedExam.id);
  const scienceSubject=scopedDetail.exam.subjects.find(s=>s.subjectId===science.id);
  await assert.rejects(service.marks({id:teacherUser.id,schoolId:school.id},scopedExam.id,{revision:1,examSubjectId:scienceSubject.id,records:[{enrollmentId:students[1].id,scores:{I:10,E:40}}]}),/not assigned/);
  const ukg=await tx.schoolClass.create({data:{schoolId:school.id,academicYearId:year.id,name:'UKG marks',academicGroup:'MONTESSORI'}}),ukgSection=await tx.section.create({data:{schoolId:school.id,classId:ukg.id,name:'A'}});
  await tx.classSubject.create({data:{schoolId:school.id,academicYearId:year.id,classId:ukg.id,subjectId:math.id}});
  await tx.studentEnrollment.update({where:{id:students[0].id},data:{classId:ukg.id,sectionId:ukgSection.id}});
  const configured=await service.savePattern(user,{academicYearId:year.id,classIds:[ukg.id,c.id],name:'Class-selected marks pattern',config:pattern});assert.equal(configured.patterns.length,2);assert.ok((await service.patterns(user,{academicYearId:year.id})).patterns.length>=2);assert.ok(configured.patterns.every(p=>p.scopeKey.startsWith('CLASS:')));
  const countBefore=await tx.assessmentPattern.count({where:{schoolId:school.id}});await assert.rejects(service.savePattern(user,{academicYearId:year.id,classIds:[ukg.id,nc.id],name:'Wrong year',config:pattern}),/school and academic year/);assert.equal(await tx.assessmentPattern.count({where:{schoolId:school.id}}),countBefore);
  await assert.rejects(service.savePattern(user,{academicYearId:year.id,classIds:[ukg.id,ukg.id],name:'Duplicate classes',config:pattern}),/each class once/);
  assert.ok((await service.patterns(user,{academicYearId:year.id,classId:ukg.id})).patterns.some(p=>p.scopeKey==='CLASS:'+ukg.id));
  const marksUkg=await service.create(user,{academicYearId:year.id,classId:ukg.id,sectionId:ukgSection.id,name:'UKG marks-based term',termKey:'T1'});assert.equal(marksUkg.type,'MARKS');
  const ukgDetail=await service.detail(user,marksUkg.id);await service.marks(user,marksUkg.id,{revision:1,examSubjectId:ukgDetail.exam.subjects[0].id,records:[{enrollmentId:students[0].id,scores:{I:15,E:65}}]});assert.equal((await service.detail(user,marksUkg.id)).marks[0].marksObtained.toNumber(),80);
  await service.savePattern(user,{academicYearId:year.id,classIds:[ukg.id],name:'Terms for spreadsheet entry',config:{...pattern,terms:[{key:'T1',label:'Term 1'},{key:'T2',label:'Term 2'},{key:'ANNUAL',label:'Annual',annual:true}]}});
  await tx.classSubject.create({data:{schoolId:school.id,academicYearId:year.id,classId:ukg.id,subjectId:science.id}});
  const termContext={academicYearId:year.id,classId:ukg.id,sectionId:ukgSection.id},examCount=await tx.exam.count({where:{schoolId:school.id}});
  assert.deepEqual((await service.terms(user,termContext)).terms.map(t=>t.key),['T1','T2','ANNUAL']);assert.equal(await tx.exam.count({where:{schoolId:school.id}}),examCount);
  const termExam=await service.openTerm(user,{...termContext,termKey:'T2'});assert.equal((await service.openTerm(user,{...termContext,termKey:'T2'})).id,termExam.id);assert.equal(await tx.exam.count({where:{schoolId:school.id}}),examCount+1);
  const td=await service.detail(user,termExam.id),subjectRecords=td.exam.subjects.map(s=>({examSubjectId:s.id,records:[{enrollmentId:students[0].id,scores:{I:15,E:60}}]}));
  await assert.rejects(service.sheet(user,termExam.id,{revision:1,subjects:[subjectRecords[0],{...subjectRecords[1],records:[{enrollmentId:students[0].id,scores:{I:99,E:60}}]}]}),/Correct every subject/);assert.equal((await service.detail(user,termExam.id)).marks.length,0);await assert.rejects(service.transition(user,termExam.id,{revision:1,action:'PUBLISH',reason:'Incomplete draft'}),/Missing assessment entries/);assert.equal((await service.detail(user,termExam.id)).exam.status,'DRAFT');
  const sheetSaved=await service.sheet(user,termExam.id,{revision:1,subjects:subjectRecords});assert.equal(sheetSaved.saved,2);assert.equal(sheetSaved.revision,3);const saveLogs=(await service.detail(user,termExam.id)).history.filter(h=>h.action==='ASSESSMENT_MARKS_CHANGED');assert.equal(saveLogs.length,2);assert.ok(saveLogs[0].metadata.saveId);assert.equal(saveLogs[0].metadata.saveId,saveLogs[1].metadata.saveId);assert.equal((await service.detail(user,termExam.id)).marks.length,2);
  await assert.rejects(service.sheet(user,termExam.id,{revision:1,subjects:subjectRecords}),/changed/);
  await tx.teacherAcademicAssignment.create({data:{schoolId:school.id,academicYearId:year.id,classId:ukg.id,sectionId:ukgSection.id,subjectId:math.id,teacherId:teacher.id}});
  const teacherActor={id:teacherUser.id,schoolId:school.id};assert.equal((await service.openTerm(teacherActor,{...termContext,termKey:'T2'})).id,termExam.id);assert.deepEqual((await service.detail(teacherActor,termExam.id)).editableSubjectIds,[td.exam.subjects.find(s=>s.subjectId===math.id).id]);
  await assert.rejects(service.sheet(teacherActor,termExam.id,{revision:3,subjects:subjectRecords}),/not assigned/);
  const previousLead=await tx.teacherAcademicAssignment.findFirst({where:{teacherId:teacher.id,academicYearId:year.id,isClassTeacher:true,isActive:true}});const leadAssignment=await tx.teacherAcademicAssignment.update({where:{id:previousLead.id},data:{classId:c.id,sectionId:a.id}});
  const classTeacherDetail=await service.detail(teacherActor,scopedExam.id);assert.equal(classTeacherDetail.editableSubjectIds.length,2);
  const teacherRows=classTeacherDetail.exam.subjects.map(subject=>({examSubjectId:subject.id,records:[{enrollmentId:students[1].id,scores:{I:12,E:60}}]}));
  const classSaved=await service.sheet(teacherActor,scopedExam.id,{revision:1,subjects:teacherRows});assert.equal(classSaved.saved,2);
  const partial=await service.sheet(teacherActor,scopedExam.id,{revision:classSaved.revision,subjects:[{examSubjectId:teacherRows[0].examSubjectId,records:[{enrollmentId:students[1].id,scores:{I:4}}]}]});
  const teacherDraft=await service.detail(teacherActor,scopedExam.id);assert.equal(teacherDraft.exam.status,'DRAFT');assert.equal(teacherDraft.marks.find(m=>m.examSubjectId===teacherRows[0].examSubjectId).marksObtained,null);
  assert.ok(teacherDraft.history.some(h=>h.metadata.actorName==='Teacher Fixture'&&h.actor.firstName==='Teacher'));
  await assert.rejects(service.transition(teacherActor,scopedExam.id,{revision:partial.revision,action:'SUBMIT',reason:'Incomplete test'}),/every configured component/);
  await tx.teacherAcademicAssignment.update({where:{id:leadAssignment.id},data:{sectionId:b.id}});
  assert.equal((await service.detail(teacherActor,scopedExam.id)).editableSubjectIds.length,1);
  await assert.rejects(service.sheet(teacherActor,scopedExam.id,{revision:partial.revision,subjects:teacherRows}),/not assigned/);
  const principal=await createUser('Principal'),principalRole=await tx.role.create({data:{schoolId:school.id,name:'Fixture approver',code:'PRINCIPAL'}});await tx.userRole.create({data:{schoolId:school.id,userId:principal.id,roleId:principalRole.id}});
  for(const code of ['MARKS_VIEW','MARKS_UPDATE','ASSESSMENT_APPROVE']){const permission=await tx.permission.findUnique({where:{code}});await tx.rolePermission.create({data:{roleId:principalRole.id,permissionId:permission.id}});}
  const principalActor={id:principal.id,schoolId:school.id};assert.deepEqual((await service.detail(principalActor,scopedExam.id)).editableSubjectIds,[]);await assert.rejects(service.sheet(principalActor,scopedExam.id,{revision:partial.revision,subjects:teacherRows}),/not assigned/);
  // Exercise real Nest routing and JWT guard against the transactional fixture.
  const {Module}=require('@nestjs/common'),{NestFactory}=require('@nestjs/core'),{JwtService}=require('@nestjs/jwt'),{JwtAuthGuard}=require('../dist/auth/jwt-auth.guard'),{PrismaService}=require('../dist/prisma/prisma.service'),{AssessmentController}=require('../dist/exams/assessment.controller');
  class FixtureModule{};Module({controllers:[AssessmentController],providers:[{provide:AssessmentService,useValue:service},{provide:AssessmentAiService,useValue:ai},{provide:PrismaService,useValue:client},{provide:JwtService,useValue:{verify(token){if(![admin.id,parentUser.id,teacherUser.id].includes(token))throw Error('Invalid fixture token');return {sub:token};}}},JwtAuthGuard]})(FixtureModule);
  const app=await NestFactory.create(FixtureModule,{logger:false});await app.listen(0,'127.0.0.1');const base=await app.getUrl();
  try{
   assert.equal((await fetch(base+'/assessments/'+obs.id)).status,401);
   const auth={Authorization:'Bearer '+admin.id};const response=await fetch(base+'/assessments/'+obs.id,{headers:auth});assert.equal(response.status,200);assert.equal((await response.json()).exam.status,'PUBLISHED');
   const parentResponse=await fetch(base+'/assessments/parent/'+students[0].id,{headers:{Authorization:'Bearer '+parentUser.id}});assert.equal(parentResponse.status,200);assert.ok((await parentResponse.json()).length>=3);
   assert.equal((await fetch(base+'/assessments/parent/'+students[1].id,{headers:{Authorization:'Bearer '+parentUser.id}})).status,403);
   const pdfResponse=await fetch(base+'/assessments/parent/reports/'+rr.id+'/pdf',{headers:{Authorization:'Bearer '+parentUser.id}});assert.equal(pdfResponse.status,200);assert.match(pdfResponse.headers.get('content-type'),/application\/pdf/);assert.equal(Buffer.from(await pdfResponse.arrayBuffer()).subarray(0,5).toString(),'%PDF-');
  }finally{await app.close();}
  await tx.$executeRawUnsafe('SAVEPOINT immutable_report_test');await assert.rejects(tx.assessmentReport.update({where:{id:rr.id},data:{version:99}}),/immutable/);await tx.$executeRawUnsafe('ROLLBACK TO SAVEPOINT immutable_report_test');
  await tx.$executeRawUnsafe('SAVEPOINT immutable_pattern_test');await assert.rejects(tx.assessmentPattern.update({where:{id:mp.id},data:{name:'Changed'}}),/immutable/);await tx.$executeRawUnsafe('ROLLBACK TO SAVEPOINT immutable_pattern_test');
  completed=true;throw rollback;
 },{timeout:55000,isolationLevel:'Serializable'});}catch(e){if(e!==rollback)throw e;}finally{await db.$disconnect();}assert.equal(completed,true);
});
