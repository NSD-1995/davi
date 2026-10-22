import { createHash, randomUUID } from 'crypto';
import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { z } from 'zod';
import { PrismaService } from '../prisma/prisma.service';
import { academicGroup } from '../academic-groups';
import { admissionsTransaction } from '../student-admissions/admissions-transaction';
import { assessmentConfigSchema, assessmentDefaults, calculateAssessment, calculateDraftAssessment, subjectAssessment, parseAssessment, recordSchema } from './assessment-rules';

const id=z.string().min(1).max(200),revision=z.number().int().positive();
const context=z.object({academicYearId:id,classId:id,sectionId:id}).strict();
const reason=z.string().trim().min(3).max(2000);
const json=(v:any)=>JSON.parse(JSON.stringify(v));
@Injectable()
export class AssessmentService {
 constructor(private readonly db:PrismaService){}
 async transaction<T>(action:(tx:any)=>Promise<T>){return admissionsTransaction(this.db,action,60000);}
 async permissions(tx:any,user:any){
  if(!user.schoolId)throw new ForbiddenException('A school account is required.');
  const roles=await tx.userRole.findMany({where:{userId:user.id,schoolId:user.schoolId,role:{schoolId:user.schoolId,isActive:true},user:{status:'ACTIVE'}},include:{role:{include:{rolePermissions:{include:{permission:true}}}}}});
  return {admin:roles.some((r:any)=>r.role.code==='SCHOOL_ADMIN'),codes:new Set<string>(roles.flatMap((r:any)=>r.role.rolePermissions.map((p:any)=>p.permission.code)))};
 }
 async require(tx:any,user:any,code:string){const p=await this.permissions(tx,user);if(!p.admin&&!p.codes.has(code))throw new ForbiddenException('Missing permission: '+code);return p;}
 async scope(tx:any,user:any,q:any,subjectId?:string,lead=false){
  const p=await this.permissions(tx,user);
  const c=await tx.schoolClass.findFirst({where:{id:q.classId,schoolId:user.schoolId,academicYearId:q.academicYearId}});
  if(!c||!await tx.section.findFirst({where:{id:q.sectionId,schoolId:user.schoolId,classId:c.id}}))throw new NotFoundException('Class or section not found in this school/year.');
  if(p.admin||(!subjectId&&p.codes.has('ASSESSMENT_APPROVE')))return c;
  const assignment=await tx.teacherAcademicAssignment.findFirst({where:{schoolId:user.schoolId,academicYearId:q.academicYearId,classId:q.classId,isActive:true,teacher:{userId:user.id,status:'ACTIVE',user:{status:'ACTIVE',staff:{is:{status:'ACTIVE'}}}},AND:[{OR:[{sectionId:q.sectionId},{sectionId:null}]},...(subjectId?[{OR:[{subjectId},{isClassTeacher:true}]}]:lead?[{isClassTeacher:true}]:[])]}});
  if(!assignment)throw new ForbiddenException('You are not assigned to this class, section or subject.');return c;
 }
 async audit(tx:any,user:any,action:string,metadata:any){const actor=user.firstName?user:await tx.user.findUnique({where:{id:user.id},select:{firstName:true,lastName:true}});await tx.auditLog.create({data:{schoolId:user.schoolId,actorId:user.id,action,method:'POST',path:'/assessments',metadata:json({...metadata,actorName:actor?[actor.firstName,actor.lastName].filter(Boolean).join(' '):'Staff member'})}});}
 async patterns(user:any,raw:unknown){
  const q=parseAssessment(context.partial({classId:true,sectionId:true}),raw);await this.require(this.db,user,'MARKS_VIEW');
  let c:any;if(q.classId){if(q.sectionId)c=await this.scope(this.db,user,q);else{await this.require(this.db,user,'ASSESSMENT_CONFIGURE');c=await this.db.schoolClass.findFirst({where:{id:q.classId,schoolId:user.schoolId,academicYearId:q.academicYearId}});if(!c)throw new NotFoundException('Class is outside this school/year.');}}
  else{await this.require(this.db,user,'ASSESSMENT_CONFIGURE');if(!await this.db.academicYear.findFirst({where:{id:q.academicYearId,schoolId:user.schoolId}}))throw new NotFoundException('Academic year is outside this school.');}
  return {defaults:assessmentDefaults,patterns:await this.db.assessmentPattern.findMany({where:{schoolId:user.schoolId,academicYearId:q.academicYearId,...(c?{scopeKey:{in:['SCHOOL','GROUP:'+academicGroup(c),'CLASS:'+c.id]}}:{})},orderBy:[{scopeKey:'asc'},{version:'desc'}],take:500})};
 }
 async savePattern(user:any,raw:unknown){const d=parseAssessment(z.union([z.object({academicYearId:id,scopeKey:id,name:z.string().trim().min(1).max(200),config:assessmentConfigSchema}).strict(),z.object({academicYearId:id,classIds:z.array(id).min(1).max(100).refine(ids=>new Set(ids).size===ids.length,'Choose each class once.'),name:z.string().trim().min(1).max(200),config:assessmentConfigSchema}).strict()]),raw);return this.transaction(async tx=>{
  await this.require(tx,user,'ASSESSMENT_CONFIGURE');
  if(!await tx.academicYear.findFirst({where:{id:d.academicYearId,schoolId:user.schoolId}}))throw new BadRequestException('Academic year is outside this school.');
  const saved:any[]=[];const scopes='classIds' in d?d.classIds.map(classId=>'CLASS:'+classId):[d.scopeKey];
  if('classIds' in d&&await tx.schoolClass.count({where:{id:{in:d.classIds},schoolId:user.schoolId,academicYearId:d.academicYearId}})!==d.classIds.length)throw new BadRequestException('Every selected class must belong to this school and academic year.');
  for(const scopeKey of scopes){
  if(scopeKey.startsWith('CLASS:')){if(!await tx.schoolClass.findFirst({where:{id:scopeKey.slice(6),schoolId:user.schoolId,academicYearId:d.academicYearId}}))throw new BadRequestException('Class is outside this school/year.');}
  else if(scopeKey!=='SCHOOL'&&!/^GROUP:(MONTESSORI|PRE_PRIMARY|PRIMARY|MIDDLE|SECONDARY|SENIOR_SECONDARY)$/.test(scopeKey))throw new BadRequestException('Choose a school, academic group or class default.');
  const previous=await tx.assessmentPattern.findFirst({where:{schoolId:user.schoolId,academicYearId:d.academicYearId,scopeKey:scopeKey},orderBy:{version:'desc'}});
  const pattern=await tx.assessmentPattern.create({data:{academicYearId:d.academicYearId,scopeKey,name:d.name,config:d.config,schoolId:user.schoolId,version:(previous?.version||0)+1,createdBy:user.id}});
  await this.audit(tx,user,'ASSESSMENT_PATTERN_VERSIONED',{patternId:pattern.id,version:pattern.version});saved.push(pattern);
  }return 'classIds' in d?{patterns:saved}:saved[0];
 });}
 async list(user:any,raw:unknown){const q=parseAssessment(context,raw);await this.require(this.db,user,'MARKS_VIEW');await this.scope(this.db,user,q);return this.db.exam.findMany({where:{schoolId:user.schoolId,academicYearId:q.academicYearId,assessmentScope:{equals:q}},select:{id:true,name:true,termKey:true,status:true,revision:true,createdAt:true},orderBy:{createdAt:'desc'},take:100});}
 async terms(user:any,raw:unknown){
  const q=parseAssessment(context,raw),{patterns}=await this.patterns(user,q),history=await this.list(user,q);
  const schoolClass=await this.scope(this.db,user,q);
  const pattern=['CLASS:'+q.classId,'GROUP:'+academicGroup(schoolClass),'SCHOOL'].map(scope=>patterns.find((p:any)=>p.scopeKey===scope)).find(Boolean);
  const config=pattern?parseAssessment(assessmentConfigSchema,pattern.config):null;
  return {terms:(config?.terms||[]).slice().sort((a,b)=>Number(Boolean(a.annual))-Number(Boolean(b.annual))||a.key.localeCompare(b.key,undefined,{numeric:true})).map(term=>{const assessment=history.find(e=>e.termKey===term.key);return {...term,patternId:pattern!.id,assessmentId:assessment?.id||null,status:assessment?.status||'NOT_STARTED'};}),history};
 }
 async openTerm(user:any,raw:unknown){const d=parseAssessment(context.extend({termKey:id}).strict(),raw);return this.transaction(async tx=>{
  await this.require(tx,user,'MARKS_UPDATE');await this.scope(tx,user,d);
  await tx.$executeRawUnsafe('SELECT pg_advisory_xact_lock(hashtext($1))',[user.schoolId,d.academicYearId,d.classId,d.sectionId,d.termKey].join(':'));
  const scope={academicYearId:d.academicYearId,classId:d.classId,sectionId:d.sectionId};
  const existing=await tx.exam.findFirst({where:{schoolId:user.schoolId,academicYearId:d.academicYearId,assessmentPatternId:{not:null},assessmentScope:{equals:scope},termKey:d.termKey},orderBy:{createdAt:'desc'}});if(existing)return existing;
  return this.create(user,{...scope,termKey:d.termKey,name:d.termKey+' assessment'},tx);
 });}
 async sheet(user:any,examId:string,raw:unknown){const d=parseAssessment(z.object({revision,subjects:z.array(z.object({examSubjectId:id,records:z.array(recordSchema).min(1).max(500)}).strict()).min(1).max(100)}).strict(),raw);
  if(new Set(d.subjects.map(s=>s.examSubjectId)).size!==d.subjects.length||d.subjects.reduce((n,s)=>n+s.records.length,0)>5000)throw new BadRequestException('Use unique subjects and at most 5000 changed student/subject records.');
  return this.transaction(async tx=>{await this.require(tx,user,'MARKS_UPDATE');const exam=await this.exam(tx,user,examId);if(exam.status!=='DRAFT'||exam.revision!==d.revision)throw new ConflictException('Assessment changed or is locked.');for(const subject of d.subjects){const checked=await this.validateRecords(tx,user,exam,subject.examSubjectId,subject.records,true);if(checked.some(r=>r.error))throw new BadRequestException('Correct every subject in the marks sheet before saving.');}const saveId=randomUUID();let current=d.revision,saved=0;for(const subject of d.subjects){const result=await this.marks(user,examId,{revision:current,...subject},false,tx,saveId);current=result.revision;saved+=result.saved||0;}return {revision:current,saved};});
 }
 async create(user:any,raw:unknown,termTx?:any){const d=parseAssessment(context.extend({name:z.string().trim().min(1).max(200),termKey:id,patternId:id.optional(),startDate:z.string().date().optional(),endDate:z.string().date().optional()}).strict(),raw);const action=async(tx:any)=>{
  await this.require(tx,user,termTx?'MARKS_UPDATE':'EXAM_CREATE');const c=await this.scope(tx,user,d,undefined,!termTx);
  const candidates=await tx.assessmentPattern.findMany({where:{schoolId:user.schoolId,academicYearId:d.academicYearId,scopeKey:{in:['SCHOOL','GROUP:'+academicGroup(c),'CLASS:'+c.id]}},orderBy:{version:'desc'}});
  const pattern=d.patternId?candidates.find((p:any)=>p.id===d.patternId):['CLASS:'+c.id,'GROUP:'+academicGroup(c),'SCHOOL'].map(scope=>candidates.find((p:any)=>p.scopeKey===scope)).find(Boolean);
  if(!pattern)throw new BadRequestException('Save an assessment pattern for this class or academic group first.');
  const config=parseAssessment(assessmentConfigSchema,pattern.config);
  if(!config.terms.some(t=>t.key===d.termKey))throw new BadRequestException('Select a configured term.');
  if(d.startDate&&d.endDate&&d.startDate>d.endDate)throw new BadRequestException('End date must follow start date.');
  const scope={academicYearId:d.academicYearId,classId:d.classId,sectionId:d.sectionId};
  const enrollments=await tx.studentEnrollment.findMany({where:{schoolId:user.schoolId,...scope,status:'ACTIVE'},include:{student:{include:{user:{select:{firstName:true,lastName:true,avatarUrl:true}}}},schoolClass:true,section:true,academicYear:true},orderBy:{id:'asc'}});
  if(!enrollments.length||enrollments.length>500)throw new BadRequestException('Assessments support between 1 and 500 enrolled students per section.');
  const roster=enrollments.map((e:any)=>({enrollmentId:e.id,studentId:e.studentId,rollNumber:e.rollNumber||null,photoUrl:e.student.user.avatarUrl||null,name:[e.student.user.firstName,e.student.user.lastName].filter(Boolean).join(' '),admissionNumber:e.admissionNumber,className:e.schoolClass.name,sectionName:e.section?.name,yearName:e.academicYear.name}));
  const exam=await tx.exam.create({data:{schoolId:user.schoolId,academicYearId:d.academicYearId,name:d.name,type:config.type,termKey:d.termKey,assessmentPatternId:pattern.id,assessmentConfig:config,assessmentScope:scope,assessmentSectionId:d.sectionId,assessmentRoster:roster,startDate:d.startDate?new Date(d.startDate):null,endDate:d.endDate?new Date(d.endDate):null}});
  if(['MARKS','MIXED','GRADE'].includes(config.type)&&!config.terms.find(t=>t.key===d.termKey)?.annual){
   const subjects=await tx.classSubject.findMany({where:{schoolId:user.schoolId,academicYearId:d.academicYearId,classId:d.classId,isActive:true,subject:{status:'ACTIVE'}}});
   if(!subjects.length)throw new BadRequestException('Assign subjects to this class before creating a marks assessment.');
   for(const s of subjects)await tx.examSubject.create({data:{examId:exam.id,classId:d.classId,subjectId:s.subjectId,maximumMarks:subjectAssessment(config,s.subjectId).components.reduce((n,c)=>n+c.maximum,0)||100,passingMarks:0}});
  }
  for(const subject of config.subjectOverrides)if(!await tx.classSubject.findFirst({where:{schoolId:user.schoolId,academicYearId:d.academicYearId,classId:d.classId,subjectId:subject.subjectId,isActive:true}}))throw new BadRequestException('Subject override is outside this class.');
  for(const comp of config.competencies)if(comp.subjectId&&!await tx.classSubject.findFirst({where:{schoolId:user.schoolId,academicYearId:d.academicYearId,classId:d.classId,subjectId:comp.subjectId,isActive:true}}))throw new BadRequestException('Competency subject is not assigned to this class.');
  await this.audit(tx,user,'ASSESSMENT_CREATED',{examId:exam.id,patternId:pattern.id,rosterCount:roster.length});return exam;
 };return termTx?action(termTx):this.transaction(action);}
 async exam(tx:any,user:any,examId:string,lead=false){const exam=await tx.exam.findFirst({where:{id:examId,schoolId:user.schoolId,assessmentPatternId:{not:null}},include:{subjects:{include:{subject:true}}}});if(!exam)throw new NotFoundException('Assessment not found.');await this.scope(tx,user,exam.assessmentScope,undefined,lead);return exam;}
 async detail(user:any,examId:string){await this.require(this.db,user,'MARKS_VIEW');const exam=await this.exam(this.db,user,examId);const [marks,observations,reports]=await Promise.all([this.db.studentMark.findMany({where:{examSubject:{examId}},orderBy:{enrollmentId:'asc'}}),this.db.assessmentObservation.findMany({where:{examId,schoolId:user.schoolId},orderBy:[{observedOn:'desc'},{createdAt:'desc'}],take:1000}),this.db.assessmentReport.findMany({where:{examId,schoolId:user.schoolId},select:{id:true,enrollmentId:true,version:true,publishedAt:true},orderBy:{version:'desc'},take:1000})]);
  const history=await this.db.auditLog.findMany({where:{schoolId:user.schoolId,path:'/assessments',metadata:{path:['examId'],equals:examId}},select:{id:true,action:true,actorId:true,actor:{select:{firstName:true,lastName:true}},metadata:true,createdAt:true},orderBy:{createdAt:'desc'},take:100});if(exam.status==='DRAFT'&&(exam.assessmentRoster as any[]).some(e=>e.rollNumber===undefined)){const scope=exam.assessmentScope as any;const current=await this.db.studentEnrollment.findMany({where:{id:{in:(exam.assessmentRoster as any[]).map(e=>e.enrollmentId)},schoolId:user.schoolId,academicYearId:exam.academicYearId,classId:scope.classId,sectionId:scope.sectionId},select:{id:true,rollNumber:true}});exam.assessmentRoster=(exam.assessmentRoster as any[]).map(e=>({...e,rollNumber:e.rollNumber===undefined?current.find(r=>r.id===e.enrollmentId)?.rollNumber||null:e.rollNumber}));}const permission=await this.permissions(this.db,user);let editableSubjectIds=exam.subjects.map((s:any)=>s.id);if(!permission.admin){const scope=exam.assessmentScope as any;const assignments=await this.db.teacherAcademicAssignment.findMany({where:{schoolId:user.schoolId,academicYearId:exam.academicYearId,classId:scope.classId,isActive:true,teacher:{userId:user.id,status:'ACTIVE',user:{status:'ACTIVE',staff:{is:{status:'ACTIVE'}}}},OR:[{sectionId:scope.sectionId},{sectionId:null}]},select:{subjectId:true,isClassTeacher:true}});editableSubjectIds=assignments.some(a=>a.isClassTeacher)?exam.subjects.map((s:any)=>s.id):exam.subjects.filter((s:any)=>assignments.some(a=>a.subjectId===s.subjectId)).map((s:any)=>s.id);}return {exam,marks,observations,reports,history,editableSubjectIds};}
 async observationHistory(user:any,examId:string,raw:unknown){const q=parseAssessment(z.object({enrollmentId:id,page:z.coerce.number().int().min(1).max(10000).default(1)}).strict(),raw);await this.require(this.db,user,'MARKS_VIEW');const exam=await this.exam(this.db,user,examId);if(!(exam.assessmentRoster as any[]).some(e=>e.enrollmentId===q.enrollmentId))throw new BadRequestException('Student is outside this assessment.');const where={examId,schoolId:user.schoolId,enrollmentId:q.enrollmentId};const [rows,total]=await Promise.all([this.db.assessmentObservation.findMany({where,orderBy:[{observedOn:'desc'},{createdAt:'desc'}],skip:(q.page-1)*50,take:50}),this.db.assessmentObservation.count({where})]);return {rows,total,page:q.page};}
 async touch(tx:any,exam:any,expected:number,status='DRAFT'){
  const changed=await tx.exam.updateMany({where:{id:exam.id,schoolId:exam.schoolId,revision:expected,status},data:{revision:{increment:1}}});if(!changed.count)throw new ConflictException('Assessment changed or is locked. Reload before saving.');
 }
 async schedule(user:any,examId:string,raw:unknown){const d=parseAssessment(z.object({revision,examSubjectId:id,examDate:z.string().date()}).strict(),raw);return this.transaction(async tx=>{await this.require(tx,user,'EXAM_UPDATE');const exam=await this.exam(tx,user,examId,true);if(!exam.subjects.some((s:any)=>s.id===d.examSubjectId))throw new BadRequestException('Subject is outside this assessment.');const day=new Date(d.examDate);if((exam.startDate&&day<exam.startDate)||(exam.endDate&&day>exam.endDate))throw new BadRequestException('Subject exam date must fall within the assessment dates.');await this.touch(tx,exam,d.revision);await tx.examSubject.update({where:{id:d.examSubjectId},data:{examDate:day}});await this.audit(tx,user,'ASSESSMENT_SCHEDULE_CHANGED',{examId,subjectId:d.examSubjectId,examDate:d.examDate});return {revision:d.revision+1};});}
 async validateRecords(tx:any,user:any,exam:any,subjectId:string,records:any[],allowIncomplete=false){
  const subject=exam.subjects.find((s:any)=>s.id===subjectId);if(!subject)throw new BadRequestException('Subject is outside this assessment.');await this.scope(tx,user,exam.assessmentScope,subject.subjectId);
  if(new Set(records.map(r=>r.enrollmentId)).size!==records.length)throw new BadRequestException('Duplicate student records in batch.');
  const roster=exam.assessmentRoster as any[];const config=subjectAssessment(parseAssessment(assessmentConfigSchema,exam.assessmentConfig),subject.subjectId);
  return records.map((r:any,index:number)=>{try{if(!roster.some(e=>e.enrollmentId===r.enrollmentId))throw new BadRequestException('Student is outside the saved class roster.');return {row:index+2,...(allowIncomplete?calculateDraftAssessment:calculateAssessment)(config,r),record:r};}catch(e:any){return {row:index+2,record:r,error:e.message};}});
 }
 async marks(user:any,examId:string,raw:unknown,preview=false,sheetTx?:any,saveId=randomUUID()){const d=parseAssessment(z.object({revision,examSubjectId:id,records:z.array(recordSchema).min(1).max(500)}).strict(),raw);const action=async(tx:any)=>{
  await this.require(tx,user,'MARKS_UPDATE');const exam=await this.exam(tx,user,examId);if(exam.status!=='DRAFT'||exam.revision!==d.revision)throw new ConflictException('Assessment changed or is locked.');
  const checked=await this.validateRecords(tx,user,exam,d.examSubjectId,d.records,Boolean(sheetTx));if(preview)return {revision:exam.revision,rows:checked};
  if(checked.some(r=>r.error))throw new BadRequestException({message:'Correct the marks import errors.',issues:checked.filter(r=>r.error)});
  await this.touch(tx,exam,d.revision);const before=await tx.studentMark.findMany({where:{examSubjectId:d.examSubjectId,enrollmentId:{in:d.records.map(r=>r.enrollmentId)}}});
  for(const r of checked){if(r.error)continue;const v=r.record;const values={componentScores:json({scores:v.scores,grade:v.grade||null}),marksObtained:(sheetTx?calculateDraftAssessment:calculateAssessment)(subjectAssessment(parseAssessment(assessmentConfigSchema,exam.assessmentConfig),exam.subjects.find((s:any)=>s.id===d.examSubjectId).subjectId),v).total,assessmentState:v.state,isAbsent:v.state==='ABSENT',remarks:v.remarks};await tx.studentMark.upsert({where:{examSubjectId_enrollmentId:{examSubjectId:d.examSubjectId,enrollmentId:v.enrollmentId}},update:{...values,revision:{increment:1}},create:{...values,examSubjectId:d.examSubjectId,enrollmentId:v.enrollmentId,sectionIdSnapshot:(exam.assessmentScope as any).sectionId,locationSnapshotted:true}});}
  await this.audit(tx,user,'ASSESSMENT_MARKS_CHANGED',{examId,saveId,examSubjectId:d.examSubjectId,before,after:d.records,revision:d.revision+1});return {revision:d.revision+1,saved:d.records.length};
 };return sheetTx?action(sheetTx):this.transaction(action);}
 async observations(user:any,examId:string,raw:unknown){const d=parseAssessment(z.object({revision,records:z.array(z.object({enrollmentId:id,competencyKey:id,rating:id,observedOn:z.string().date(),remarks:z.string().trim().min(1).max(2000),evidence:z.string().max(2000).optional(),requestKey:z.string().uuid()}).strict()).min(1).max(500)}).strict(),raw);return this.transaction(async tx=>{
  await this.require(tx,user,'MARKS_UPDATE');const exam=await this.exam(tx,user,examId);const config=parseAssessment(assessmentConfigSchema,exam.assessmentConfig);
  if(!['OBSERVATION','COMPETENCY','MIXED'].includes(config.type))throw new BadRequestException('This assessment does not accept observations.');
  if(new Set(d.records.map(r=>r.requestKey)).size!==d.records.length)throw new BadRequestException('Duplicate observation request keys.');
  for(const r of d.records){const comp=config.competencies.find(c=>c.key===r.competencyKey);if(!comp||!config.ratings.some(x=>x.key===r.rating)||!(exam.assessmentRoster as any[]).some(e=>e.enrollmentId===r.enrollmentId))throw new BadRequestException('Invalid competency, rating or student.');
   await this.scope(tx,user,exam.assessmentScope,comp.subjectId,!comp.subjectId);
   const day=new Date(r.observedOn);if(day>new Date()||(exam.startDate&&day<exam.startDate)||(exam.endDate&&day>exam.endDate))throw new BadRequestException('Observation date is outside the assessment dates or in the future.');
  }
  await this.touch(tx,exam,d.revision);for(const r of d.records)await tx.assessmentObservation.create({data:{...r,observedOn:new Date(r.observedOn),schoolId:user.schoolId,academicYearId:exam.academicYearId,examId,actorId:user.id}});
  await this.audit(tx,user,'ASSESSMENT_OBSERVATIONS_ADDED',{examId,records:d.records,revision:d.revision+1});return {revision:d.revision+1,saved:d.records.length};
 });}
 async transition(user:any,examId:string,raw:unknown){const d=parseAssessment(z.object({revision,action:z.enum(['SUBMIT','REVIEW','APPROVE','PUBLISH','REOPEN','RETURN']),reason}).strict(),raw);return this.transaction(async tx=>{
  const permissions={SUBMIT:'MARKS_UPDATE',REVIEW:'ASSESSMENT_REVIEW',APPROVE:'ASSESSMENT_APPROVE',PUBLISH:'ASSESSMENT_PUBLISH',REOPEN:'ASSESSMENT_CORRECT',RETURN:'ASSESSMENT_REVIEW'};await this.require(tx,user,permissions[d.action]);const exam=await this.exam(tx,user,examId,true);
  const states={SUBMIT:['DRAFT','SUBMITTED'],REVIEW:['SUBMITTED','REVIEWED'],APPROVE:['REVIEWED','APPROVED'],PUBLISH:[exam.status,'PUBLISHED'],REOPEN:['PUBLISHED','DRAFT'],RETURN:[exam.status,'DRAFT']};const [from,to]=states[d.action];
  if(d.action==='PUBLISH'&&!['DRAFT','APPROVED'].includes(exam.status))throw new ConflictException('Only a draft or approved assessment can be published.');
  if(d.action==='RETURN'&&!['SUBMITTED','REVIEWED','APPROVED'].includes(exam.status))throw new ConflictException('Only a pending review or approval can be returned for correction.');
  if(d.action==='SUBMIT'||d.action==='PUBLISH')await this.complete(tx,exam);
  await this.touch(tx,exam,d.revision,from);
  await tx.exam.update({where:{id:examId},data:{status:to,...(d.action==='REVIEW'?{reviewedBy:user.id}:{}),...(d.action==='APPROVE'?{approvedBy:user.id,approvedAt:new Date()}:{}),...((d.action==='REOPEN'||d.action==='RETURN')?{reviewedBy:null,approvedBy:null,approvedAt:null}:{})}});
  if(d.action==='PUBLISH')await this.publish(tx,user,exam);
  await this.audit(tx,user,'ASSESSMENT_'+d.action,{examId,from,to,reason:d.reason,revision:d.revision+1});return {status:to,revision:d.revision+1};
 });}
 async annualTerms(tx:any,exam:any,enrollmentId:string){
  const config=parseAssessment(assessmentConfigSchema,exam.assessmentConfig);
  const reports=await tx.assessmentReport.findMany({where:{schoolId:exam.schoolId,academicYearId:exam.academicYearId,enrollmentId,examId:{not:exam.id},exam:{assessmentScope:{equals:exam.assessmentScope}}},orderBy:{publishedAt:'desc'},take:500});
  const terms:any[]=[];
  for(const term of config.terms.filter(t=>!t.annual)){
   const report=reports.find((r:any)=>r.snapshot.assessment.termKey===term.key&&!r.snapshot.assessment.config.terms.find((t:any)=>t.key===term.key)?.annual);
   if(!report)throw new BadRequestException('Publish '+term.label+' for each child before generating annual progress cards.');terms.push(report.snapshot);
  }if(!terms.length)throw new BadRequestException('Configure non-annual terms before creating an annual progress card.');return terms;
 }
 async complete(tx:any,exam:any){
  const config=parseAssessment(assessmentConfigSchema,exam.assessmentConfig),roster=exam.assessmentRoster as any[];
  if(config.terms.find(t=>t.key===exam.termKey)?.annual){for(const e of roster)await this.annualTerms(tx,exam,e.enrollmentId);return;}
  const marks=await tx.studentMark.findMany({where:{examSubject:{examId:exam.id}}});const observations=await tx.assessmentObservation.findMany({where:{examId:exam.id}});
  const missing:string[]=[];for(const e of roster){for(const s of exam.subjects){const m=marks.find((m:any)=>m.enrollmentId===e.enrollmentId&&m.examSubjectId===s.id);if(!m)missing.push(e.name+' / '+s.subject.name);else calculateAssessment(subjectAssessment(config,s.subjectId),{enrollmentId:e.enrollmentId,state:m.assessmentState,scores:(m.componentScores as any)?.scores||{},grade:(m.componentScores as any)?.grade||undefined,remarks:m.remarks||''});}
   for(const c of config.competencies)if(!observations.some((o:any)=>o.enrollmentId===e.enrollmentId&&o.competencyKey===c.key))missing.push(e.name+' / '+c.label);
  }if(missing.length)throw new BadRequestException('Missing assessment entries: '+missing.slice(0,10).join('; ')+(missing.length>10?' and '+(missing.length-10)+' more.':''));
 }
 async publish(tx:any,user:any,exam:any){
  await this.complete(tx,exam);const config=parseAssessment(assessmentConfigSchema,exam.assessmentConfig);
  const [marks,observations,school]=await Promise.all([tx.studentMark.findMany({where:{examSubject:{examId:exam.id}}}),tx.assessmentObservation.findMany({where:{examId:exam.id},orderBy:[{observedOn:'asc'},{createdAt:'asc'}]}),tx.school.findUnique({where:{id:user.schoolId},include:{settings:true}})]);
  for(const student of exam.assessmentRoster as any[]){
   const annual=config.terms.find(t=>t.key===exam.termKey)?.annual;
   const childObservations=observations.filter((o:any)=>o.enrollmentId===student.enrollmentId).sort((a:any,b:any)=>a.id.localeCompare(b.id)).slice(0,500);
   const evidenceHash=createHash('sha256').update(JSON.stringify(childObservations)).digest('hex');
   const comment=await tx.aiGeneration.findFirst({where:{schoolId:user.schoolId,feature:'ASSESSMENT_COMMENT',status:'REVIEWED',AND:[{input:{path:['examId'],equals:exam.id}},{input:{path:['enrollmentId'],equals:student.enrollmentId}},{input:{path:['evidenceHash'],equals:evidenceHash}}]},orderBy:{updatedAt:'desc'}});
   const snapshot={teacherComment:comment?.output?.text||null,school:{name:school.name,address:school.address,logoUrl:school.settings?.logoUrl||null},student,assessment:{name:exam.name,termKey:exam.termKey,type:config.type,config,...config.branding,approvedBy:exam.approvedBy,approvedAt:exam.approvedAt,revision:exam.revision+1},subjects:exam.subjects.map((s:any)=>{const m=marks.find((m:any)=>m.examSubjectId===s.id&&m.enrollmentId===student.enrollmentId);return {name:s.subject.name,components:m?.componentScores,...(m?calculateAssessment(subjectAssessment(config,s.subjectId),{enrollmentId:student.enrollmentId,state:m.assessmentState,scores:m.componentScores?.scores||{},grade:m.componentScores?.grade||undefined,remarks:m.remarks||''}):{})};}),competencies:annual?[]:config.competencies.map(c=>{const history=observations.filter((o:any)=>o.enrollmentId===student.enrollmentId&&o.competencyKey===c.key);const latest=history.at(-1);return {...c,rating:config.ratings.find(r=>r.key===latest?.rating)?.label||'Not Yet Observed',history};}),...(annual?{terms:await this.annualTerms(tx,exam,student.enrollmentId)}:{})};
   await tx.assessmentReport.create({data:{schoolId:user.schoolId,academicYearId:exam.academicYearId,examId:exam.id,enrollmentId:student.enrollmentId,version:exam.revision+1,snapshot:json(snapshot)}});
  }
 }
 async parentReports(user:any,enrollmentId:string){await this.parentEnrollment(user,enrollmentId);return this.db.assessmentReport.findMany({where:{enrollmentId},select:{id:true,examId:true,version:true,publishedAt:true,snapshot:true},orderBy:{publishedAt:'desc'},take:100});}
 async parentEnrollment(user:any,enrollmentId:string){const enrollment=await this.db.studentEnrollment.findFirst({where:{id:enrollmentId,student:{studentParents:{some:{status:'ACTIVE',canViewAcademics:true,parent:{userId:user.id,user:{status:'ACTIVE'}}}}}}});if(!enrollment||!await this.db.parentSchoolMembership.findFirst({where:{schoolId:enrollment.schoolId,status:'ACTIVE',verificationStatus:'VERIFIED',parent:{userId:user.id}}}))throw new ForbiddenException('You cannot view this child.');return enrollment;}
 async report(user:any,reportId:string,parent=false){const report=await this.db.assessmentReport.findUnique({where:{id:reportId}});if(!report)throw new NotFoundException('Published report not found.');if(parent){const e=await this.parentEnrollment(user,report.enrollmentId);if(e.schoolId!==report.schoolId)throw new ForbiddenException('School access denied.');}else{await this.require(this.db,user,'REPORT_VIEW');if(report.schoolId!==user.schoolId)throw new NotFoundException('Report not found.');await this.exam(this.db,user,report.examId);}return report;}
 async consolidated(user:any,examId:string){await this.require(this.db,user,'REPORT_VIEW');await this.exam(this.db,user,examId);return this.db.assessmentReport.findMany({where:{examId,schoolId:user.schoolId},orderBy:[{enrollmentId:'asc'},{version:'desc'}],take:5000});}
}
