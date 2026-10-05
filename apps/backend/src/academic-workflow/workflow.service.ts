import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { readFile } from 'fs/promises';
import { extname } from 'path';
import { z } from 'zod';
import { PrismaService } from '../prisma/prisma.service';
import { AcademicScopeService } from '../ai/academic-scope.service';
import { AiProviderService } from '../ai/ai-provider.service';
import * as dto from './workflow.dto';
import { analyzeEvidence, buildTeachingPlan, flattenTopics } from './planner';

function parse<T>(schema:z.ZodType<T,any,any>,value:unknown):T {const result=schema.safeParse(value);if(!result.success)throw new BadRequestException(result.error.issues.map(i=>i.message).join('; '));return result.data;}
const date=(s:string)=>new Date(`${s}T00:00:00Z`);
const dateString=(d:Date)=>d.toISOString().slice(0,10);

@Injectable()
export class WorkflowService {
  private readonly generating=new Set<string>();
  constructor(private readonly db:PrismaService,private readonly scope:AcademicScopeService,private readonly ai:AiProviderService){}

  private async authorize(user:any,scope:any){
    await this.scope.assert(user,scope);
    if(!await this.db.section.findFirst({where:{id:scope.sectionId,schoolId:scope.schoolId,classId:scope.classId}}))throw new ForbiddenException('Section is outside this class.');
    const admin=(user.roles||[]).some((r:string)=>r.toUpperCase().replace(/-/g,'_')==='SCHOOL_ADMIN');
    if(!admin&&!await this.db.teacherAcademicAssignment.findFirst({where:{schoolId:scope.schoolId,academicYearId:scope.academicYearId,classId:scope.classId,subjectId:scope.subjectId,teacher:{userId:user.id},isActive:true,OR:[{sectionId:scope.sectionId},{sectionId:null}]}}))throw new ForbiddenException('Teacher is not assigned to this section.');
  }
  private async program(user:any,id:string){
    if(!user.schoolId)throw new ForbiddenException('School access required.');
    const p=await this.db.academicProgram.findFirst({where:{id,schoolId:user.schoolId}});
    if(!p)throw new NotFoundException('Academic program not found.');
    await this.authorize(user,p);return p;
  }
  private classroom(p:any){return {schoolId:p.schoolId,academicYearId:p.academicYearId,classId:p.classId,sectionId:p.sectionId};}
  private async enrollment(p:any,id:string){const e=await this.db.studentEnrollment.findFirst({where:{id,...this.classroom(p),status:'ACTIVE'}});if(!e)throw new ForbiddenException('Student is not enrolled in this classroom.');return e;}
  private async claim(tx:any,id:string,revision:number){const result=await tx.academicProgram.updateMany({where:{id,revision},data:{revision:{increment:1}}});if(result.count!==1)throw new ConflictException('This program changed. Reload before saving.');}
  private approved(p:any){if(p.status!=='APPROVED')throw new ConflictException('Review and approve the curriculum first.');}
  private async generate<T>(user:any,feature:string,input:unknown,instructions:string,schema:z.ZodType<T,any,any>){
    if(this.generating.has(user.id))throw new ConflictException('An AI request is already running for your account.');
    this.generating.add(user.id);
    try{
      const since=new Date();since.setUTCHours(0,0,0,0);
      if(await this.db.aiGeneration.count({where:{userId:user.id,schoolId:user.schoolId,createdAt:{gte:since}}})>=50)throw new ConflictException('Daily limit of 50 saved AI generations reached.');
      const result=await this.ai.structured(`${feature.toLowerCase()}-v1`,instructions,input,schema);
      const saved=await this.db.aiGeneration.create({data:{schoolId:user.schoolId,userId:user.id,feature,model:result.model,promptVersion:result.promptVersion,input:input as any,output:result.output as any,inputTokens:result.inputTokens,outputTokens:result.outputTokens,status:'DRAFT'}});
      return {content:result.output,generationId:saved.id};
    }finally{this.generating.delete(user.id);}
  }

  async list(user:any,raw:unknown){const s=parse(dto.scopeSchema,raw);await this.authorize(user,s);return this.db.academicProgram.findMany({where:s,orderBy:{createdAt:'desc'}});}
  async get(user:any,id:string){const p=await this.program(user,id);
    const admin=(user.roles||[]).some((r:string)=>r.toUpperCase().replace(/-/g,'_')==='SCHOOL_ADMIN');
    const mappings=admin?[]:await this.db.userRole.findMany({where:{userId:user.id},include:{role:{include:{rolePermissions:{include:{permission:true}}}}}});
    const grants=new Set(mappings.flatMap(m=>m.role.rolePermissions.map(r=>r.permission.code)));
    const has=(permission:string)=>admin||grants.has(permission);
    const [sessions,papers,interventions,insights,enrollments,terms]=await Promise.all([
    this.db.academicTeachingSession.findMany({where:{programId:id},orderBy:[{scheduledDate:'asc'},{startTime:'asc'}]}),
    has('HOMEWORK_VIEW')||has('EXAM_VIEW')?this.db.academicPaper.findMany({where:{programId:id},include:{results:has('MARKS_VIEW')||has('MARKS_UPDATE')},orderBy:{createdAt:'desc'}}):[],
    has('REPORT_VIEW')?this.db.academicIntervention.findMany({where:{programId:id},orderBy:{dueDate:'asc'}}):[],
    has('REPORT_VIEW')?this.db.academicInsight.findMany({where:{programId:id},orderBy:{createdAt:'desc'}}):[],
    has('REPORT_VIEW')||has('MARKS_VIEW')||has('MARKS_UPDATE')?this.db.studentEnrollment.findMany({where:{...this.classroom(p),status:'ACTIVE'},select:{id:true,student:{select:{user:{select:{firstName:true,lastName:true}}}}}}):[],
    this.db.schoolTerm.findMany({where:{schoolId:p.schoolId,academicYearId:p.academicYearId},orderBy:{sortOrder:'asc'}}),
  ]);return {...p,sessions,papers,interventions,insights,enrollments,terms};}

  async create(user:any,raw:unknown){
    const d=parse(dto.createProgramSchema,raw);await this.authorize(user,d);
    const syllabus=await this.db.syllabus.findFirst({where:{id:d.syllabusId,schoolId:d.schoolId,academicYearId:d.academicYearId,classId:d.classId,subjectId:d.subjectId},include:{lessons:{include:{topics:true},orderBy:{sortOrder:'asc'}}}});
    if(!syllabus)throw new NotFoundException('Syllabus does not match the selected subject and class.');
    const curriculum={units:[{title:'Imported syllabus',termId:syllabus.termId,lessons:syllabus.lessons.map((l,i)=>({title:l.title,topics:l.topics.map((t,j)=>({code:`T${i+1}_${j+1}`,title:t.title,subtopics:[],outcomes:[`Demonstrate understanding of ${t.title}`],prerequisites:[],periods:1}))}))}]};
    return this.db.academicProgram.create({data:{...d,createdById:user.id,curriculum,calendar:{terms:[],workingDays:[1,2,3,4,5],holidays:[],unavailableDates:[],weeklySlots:[],revisionPeriods:0}}});
  }

  async analyze(user:any,id:string){
    const p=await this.program(user,id);if(p.status!=='DRAFT')throw new ConflictException('Approved curricula cannot be overwritten. Create a new program version.');
    const syllabus=await this.db.syllabus.findFirst({where:{id:p.syllabusId,schoolId:p.schoolId}});if(!syllabus)throw new NotFoundException('Source syllabus not found.');
    const buffer=await readFile(syllabus.storageKey);let source='';const extension=extname(syllabus.fileName).toLowerCase();
    if(extension==='.pdf')source=String((await require('pdf-parse')(buffer)).text||'');
    else if(extension==='.docx')source=String((await require('mammoth').extractRawText({buffer})).value||'');
    else source=buffer.toString('utf8');
    if(!source.trim()||source.length>80000)throw new BadRequestException('Use a readable syllabus of at most 80,000 extracted characters; split longer files. Scanned files need OCR before upload.');
    const result=await this.generate(user,'SYLLABUS_ANALYZER',{source,termId:syllabus.termId},'Extract the provided syllabus without adding unrelated curriculum. Return {units:[{title,termId,lessons:[{title,topics:[{code,title,subtopics: string[],outcomes: string[],prerequisites: string[],periods: integer}]}]}]}. Use the supplied termId for all units. Give each topic a unique short alphanumeric code, estimated periods 1-60 and at least one measurable outcome. Prerequisites must be codes of earlier topics, otherwise []. Preserve unit/lesson/topic/subtopic hierarchy. Estimates and outcomes are educator-review drafts.',dto.curriculumSchema);
    if(result.content.units.some(u=>u.termId!==syllabus.termId))throw new BadRequestException('AI returned an invalid term allocation.');
    await this.db.$transaction(async tx=>{await this.claim(tx,id,p.revision);await tx.academicProgram.update({where:{id},data:{curriculum:result.content,reviewedAt:null}});});return {updated:true};
  }

  async review(user:any,id:string,raw:unknown,calendarOnly=false){
    const p=await this.program(user,id),d=parse(dto.reviewProgramSchema,raw);
    if(p.status!=='DRAFT'&&(!calendarOnly||JSON.stringify(d.curriculum)!==JSON.stringify(parse(dto.curriculumSchema,p.curriculum))))throw new ConflictException('Approved curriculum is immutable. Use replan for teaching progress or create a new program.');
    const terms=await this.db.schoolTerm.findMany({where:{schoolId:p.schoolId,academicYearId:p.academicYearId}});
    if(d.calendar.terms.some(t=>!terms.some(x=>x.id===t.id))||d.curriculum.units.some(u=>!d.calendar.terms.some(t=>t.id===u.termId)))throw new BadRequestException('Allocate each unit to a dated term in this academic year.');
    const year=await this.db.academicYear.findUnique({where:{id:p.academicYearId}});
    if(d.calendar.terms.some(t=>(year?.startDate&&date(t.start)<year.startDate)||(year?.endDate&&date(t.end)>year.endDate)))throw new BadRequestException('Term dates must fall within the academic year.');
    const orderedTerms=[...d.calendar.terms].sort((a,b)=>a.start.localeCompare(b.start)).map(t=>t.id),topics=flattenTopics(d.curriculum);
    if(topics.some(t=>t.prerequisites.some(code=>orderedTerms.indexOf(topics.find(x=>x.code===code)!.termId)>orderedTerms.indexOf(t.termId))))throw new BadRequestException('A prerequisite cannot be allocated to a later term.');
    await this.db.$transaction(async tx=>{await this.claim(tx,id,d.revision);await tx.academicProgram.update({where:{id},data:{curriculum:d.curriculum,calendar:d.calendar,reviewedAt:new Date()}});});return {updated:true};
  }
  async updateCalendar(user:any,id:string,raw:unknown){const p=await this.program(user,id);const d=parse(z.object({revision:z.number().int().min(0),calendar:dto.calendarSchema}).strict(),raw);return this.review(user,id,{...d,curriculum:p.curriculum},true);}
  async approve(user:any,id:string,raw:unknown){const p=await this.program(user,id),d=parse(dto.revisionSchema,raw);if(p.status!=='DRAFT'||!p.reviewedAt)throw new ConflictException('Save the curriculum and calendar review before approval.');parse(dto.curriculumSchema,p.curriculum);parse(dto.calendarSchema,p.calendar);await this.db.$transaction(async tx=>{await this.claim(tx,id,d.revision);await tx.academicProgram.update({where:{id},data:{status:'APPROVED',approvedAt:new Date(),approvedById:user.id}});});return {updated:true};}

  async plan(user:any,id:string,raw:unknown){
    const p=await this.program(user,id),d=parse(dto.planSchema,raw);this.approved(p);const curriculum=parse(dto.curriculumSchema,p.curriculum),calendar=parse(dto.calendarSchema,p.calendar);
    // Published timetable slots are authoritative when available; manual slots are a fallback.
    const timetable=await this.db.timetableEntry.findMany({where:{...this.classroom(p),subjectId:p.subjectId,timetablePlan:{status:'PUBLISHED'}},include:{periodSlot:true,period:true}});
    if(timetable.length){calendar.weeklySlots=timetable.map(e=>{const slot=e.periodSlot||e.period;return {weekday:e.weekday,start:slot?.startTime||'',minutes:slot?this.minutes(slot.startTime,slot.endTime):0};});parse(dto.calendarSchema,calendar);}
    if(!calendar.weeklySlots.length)throw new BadRequestException('Publish a subject timetable or add weekly teaching periods.');
    const events=await this.db.schoolEvent.findMany({where:{schoolId:p.schoolId,status:'ACTIVE',eventType:{in:['HOLIDAY','EXAM','NON_WORKING_DAY']}}});
    for(const event of events){const end=event.endsAt||event.startsAt;for(let day=date(dateString(event.startsAt));day<=end;day=new Date(+day+86400000)){if(calendar.holidays.length>=2000)throw new BadRequestException('Too many blocked calendar days.');calendar.holidays.push({date:dateString(day),label:event.title});}}
    const sessions=await this.db.academicTeachingSession.findMany({where:{programId:id}});
    const protectedSessions=sessions.filter(s=>s.status==='COMPLETED'||s.lessonContent||dateString(s.scheduledDate)<d.from);
    const completed:Record<string,number>={},reservedThrough:Record<string,string>={};
    for(const session of protectedSessions)if(session.status==='COMPLETED'||(session.status==='PLANNED'&&dateString(session.scheduledDate)>=d.from)){
      completed[session.topicCode]=(completed[session.topicCode]||0)+1;
      const marker=`${dateString(session.scheduledDate)}:${session.startTime}`;
      if(marker>(reservedThrough[session.topicCode]||''))reservedThrough[session.topicCode]=marker;
    }
    const other=await this.db.academicTeachingSession.findMany({where:{programId:{not:id},program:{schoolId:p.schoolId,academicYearId:p.academicYearId,sectionId:p.sectionId},status:{in:['PLANNED','COMPLETED']}}});
    const occupied=protectedSessions.map(s=>`${dateString(s.scheduledDate)}:${s.startTime}`);
    // Exclude any overlapping period, not only equal start times.
    for(const s of other)for(const slot of calendar.weeklySlots){if(this.overlaps(s.startTime,s.minutes,slot.start,slot.minutes))occupied.push(`${dateString(s.scheduledDate)}:${slot.start}`);}
    const result=buildTeachingPlan(curriculum,calendar,d.from,completed,occupied,reservedThrough);
    if(result.shortages.length)return {...result,saved:false,message:'Not enough teaching periods. Adjust term allocation, timetable, holidays or topic estimates. No existing plan was changed.'};
    await this.db.$transaction(async tx=>{
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${p.schoolId+':'+p.academicYearId+':'+p.sectionId}))`;
      await this.claim(tx,id,d.revision);
      const concurrent=await tx.academicTeachingSession.findMany({where:{programId:{not:id},program:{schoolId:p.schoolId,academicYearId:p.academicYearId,sectionId:p.sectionId},status:{in:['PLANNED','COMPLETED']}}});
      if(result.sessions.some(s=>concurrent.some(other=>dateString(other.scheduledDate)===s.date&&this.overlaps(other.startTime,other.minutes,s.start,s.minutes))))throw new ConflictException('Another subject was scheduled in these periods. Reload and replan.');
      await tx.academicTeachingSession.deleteMany({where:{programId:id,id:{notIn:protectedSessions.map(s=>s.id)}}});
      if(result.sessions.length)await tx.academicTeachingSession.createMany({data:result.sessions.map(s=>({programId:id,topicCode:s.topicCode,title:s.title,scheduledDate:date(s.date),startTime:s.start,minutes:s.minutes}))});
    });return {...result,saved:true};
  }
  private minutes(start:string,end:string){return Number(end.slice(0,2))*60+Number(end.slice(3))-Number(start.slice(0,2))*60-Number(start.slice(3));}
  private overlaps(a:string,minutes:number,b:string,other:number){const diff=this.minutes(a,b);return diff<minutes&&diff+other>0;}
  private async session(p:any,id:string){const s=await this.db.academicTeachingSession.findFirst({where:{id,programId:p.id}});if(!s)throw new NotFoundException('Teaching session not found.');return s;}
  async progress(user:any,id:string,sessionId:string,raw:unknown){const p=await this.program(user,id);this.approved(p);const s=await this.session(p,sessionId),d=parse(dto.progressSchema,raw);if(d.status==='COMPLETED'&&s.lessonStatus!=='APPROVED')throw new ConflictException('Approve the lesson before marking it taught.');await this.db.$transaction(async tx=>{await this.claim(tx,id,p.revision);const updated=await tx.academicTeachingSession.updateMany({where:{id:sessionId,revision:d.revision},data:{status:d.status,progressNotes:d.notes,completedAt:d.status==='COMPLETED'?new Date():null,revision:{increment:1}}});if(!updated.count)throw new ConflictException('Session changed; reload.');if(s.lessonPlanId)await tx.lessonPlan.update({where:{id:s.lessonPlanId},data:{coveragePercent:d.status==='COMPLETED'?100:0}});});return {updated:true};}
  async generateLesson(user:any,id:string,sessionId:string){const p=await this.program(user,id);this.approved(p);const s=await this.session(p,sessionId);if(s.lessonStatus==='APPROVED')throw new ConflictException('Approved lessons cannot be regenerated.');const topic=flattenTopics(parse(dto.curriculumSchema,p.curriculum)).find(t=>t.code===s.topicCode);const result=await this.generate(user,'TEACHING_LESSON',{topic,minutes:s.minutes},'Create a practical lesson aligned to the supplied topic and measurable outcomes. Return {title,objectives:string[],materials:string[],teachingSteps:string[],activities:string[],assessment,homework,differentiation}. All scalar fields are strings.',dto.lessonContentSchema);await this.db.$transaction(async tx=>{await this.claim(tx,id,p.revision);const updated=await tx.academicTeachingSession.updateMany({where:{id:sessionId,revision:s.revision,lessonStatus:{not:'APPROVED'}},data:{lessonContent:result.content,generationId:result.generationId,lessonStatus:'DRAFT',reviewedAt:null,revision:{increment:1}}});if(!updated.count)throw new ConflictException('Session changed while generating. Reload.');});return {updated:true};}
  async reviewLesson(user:any,id:string,sessionId:string,raw:unknown){const p=await this.program(user,id);const s=await this.session(p,sessionId);const d=parse(z.object({revision:z.number().int(),content:dto.lessonContentSchema}).strict(),raw);if(s.lessonStatus==='APPROVED')throw new ConflictException('Approved lessons are immutable.');await this.db.$transaction(async tx=>{await this.claim(tx,id,p.revision);const changed=await tx.academicTeachingSession.updateMany({where:{id:sessionId,revision:d.revision},data:{lessonContent:d.content,lessonStatus:'DRAFT',reviewedAt:new Date(),revision:{increment:1}}});if(!changed.count)throw new ConflictException('Session changed; reload.');});return {updated:true};}
  async approveLesson(user:any,id:string,sessionId:string,raw:unknown){const p=await this.program(user,id);this.approved(p);const s=await this.session(p,sessionId),d=parse(dto.revisionSchema,raw);if(!s.reviewedAt||s.lessonStatus!=='DRAFT')throw new ConflictException('Save a reviewed lesson first.');const content=parse(dto.lessonContentSchema,s.lessonContent);await this.db.$transaction(async tx=>{await this.claim(tx,id,p.revision);const changed=await tx.academicTeachingSession.updateMany({where:{id:sessionId,revision:d.revision,lessonStatus:'DRAFT'},data:{lessonStatus:'APPROVED',revision:{increment:1}}});if(!changed.count)throw new ConflictException('Session changed; reload.');const lesson=await tx.lessonPlan.create({data:{...this.classroom(p),subjectId:p.subjectId,title:content.title,objectives:content.objectives.join('\n'),content:JSON.stringify(content),scheduledDate:s.scheduledDate,status:'APPROVED',syllabusUnit:s.topicCode}});await tx.academicTeachingSession.update({where:{id:sessionId},data:{lessonPlanId:lesson.id}});});return {updated:true};}

  private validatePaper(p:any,content:z.infer<typeof dto.paperSchema>){const topics=flattenTopics(parse(dto.curriculumSchema,p.curriculum));if(content.questions.some(q=>!topics.some(t=>t.code===q.topicCode&&t.outcomes.includes(q.outcome))))throw new BadRequestException('Each question must reference a curriculum topic and one of its exact learning outcomes.');}
  async generatePaper(user:any,id:string,raw:unknown){const p=await this.program(user,id);this.approved(p);const d=parse(dto.generatePaperSchema,raw),topics=flattenTopics(parse(dto.curriculumSchema,p.curriculum)).filter(t=>d.topicCodes.includes(t.code));if(topics.length!==new Set(d.topicCodes).size)throw new BadRequestException('Unknown curriculum topic.');const result=await this.generate(user,d.kind,{topics,questionCount:d.questionCount,kind:d.kind},'Create the requested homework or question paper. Return {title,instructions,questions:[{code,topicCode,outcome,prompt,answer,marks,difficulty}]}. Use unique question codes, exact supplied topic codes and outcome strings. marks is integer 1-100; difficulty EASY, MEDIUM or HARD. Include exactly questionCount questions and a teacher answer key. Do not include unrelated topics.',dto.paperSchema);this.validatePaper(p,result.content);if(result.content.questions.length!==d.questionCount)throw new BadRequestException('AI returned the wrong question count.');return this.db.academicPaper.create({data:{programId:id,kind:d.kind,content:result.content,dueDate:date(d.dueDate),generationId:result.generationId}});}
  private async paper(id:string,paperId:string){const p=await this.db.academicPaper.findFirst({where:{id:paperId,programId:id}});if(!p)throw new NotFoundException('Question paper not found.');return p;}
  async reviewPaper(user:any,id:string,paperId:string,raw:unknown){const p=await this.program(user,id),paper=await this.paper(id,paperId),d=parse(z.object({revision:z.number().int(),content:dto.paperSchema}).strict(),raw);if(paper.status!=='DRAFT')throw new ConflictException('Published papers are immutable.');this.validatePaper(p,d.content);const changed=await this.db.academicPaper.updateMany({where:{id:paperId,revision:d.revision,status:'DRAFT'},data:{content:d.content,reviewedAt:new Date(),revision:{increment:1}}});if(!changed.count)throw new ConflictException('Paper changed; reload.');return {updated:true};}
  async publishPaper(user:any,id:string,paperId:string,raw:unknown){const p=await this.program(user,id);this.approved(p);const paper=await this.paper(id,paperId),d=parse(dto.revisionSchema,raw);if(!paper.reviewedAt||paper.status!=='DRAFT')throw new ConflictException('Save a reviewed paper before publishing.');const content=parse(dto.paperSchema,paper.content);await this.db.$transaction(async tx=>{const changed=await tx.academicPaper.updateMany({where:{id:paperId,revision:d.revision,status:'DRAFT'},data:{status:'PUBLISHED',publishedAt:new Date(),revision:{increment:1}}});if(!changed.count)throw new ConflictException('Paper changed; reload.');if(paper.kind==='HOMEWORK'){const enrollments=await tx.studentEnrollment.findMany({where:{...this.classroom(p),status:'ACTIVE'},select:{id:true}});const homework=await tx.homework.create({data:{...this.classroom(p),subjectId:p.subjectId,title:content.title,description:content.instructions+'\n\n'+content.questions.map((q,i)=>`${i+1}. ${q.prompt} (${q.marks} marks)`).join('\n'),dueAt:paper.dueDate,status:'PUBLISHED',submissions:{create:enrollments.map(e=>({enrollmentId:e.id}))}}});await tx.academicPaper.update({where:{id:paperId},data:{homeworkId:homework.id}});}else{const total=content.questions.reduce((sum,q)=>sum+q.marks,0);const exam=await tx.exam.create({data:{schoolId:p.schoolId,academicYearId:p.academicYearId,name:content.title+' '+paper.id.slice(0,8),type:'FORMATIVE',startDate:paper.dueDate,status:'PUBLISHED'}});const examSubject=await tx.examSubject.create({data:{examId:exam.id,classId:p.classId,subjectId:p.subjectId,examDate:paper.dueDate,maximumMarks:total,passingMarks:total*0.6}});await tx.academicPaper.update({where:{id:paperId},data:{examSubjectId:examSubject.id}});}});return {updated:true};}
  async marks(user:any,id:string,paperId:string,raw:unknown){const p=await this.program(user,id),paper=await this.paper(id,paperId),d=parse(dto.marksSchema,raw);await this.enrollment(p,d.enrollmentId);if(paper.status!=='PUBLISHED')throw new ConflictException('Publish the paper before recording marks.');const content=parse(dto.paperSchema,paper.content);if(d.absent&&d.scores.length)throw new BadRequestException('Absent students cannot have marks.');if(!d.absent&&(d.scores.length!==content.questions.length||new Set(d.scores.map(s=>s.questionCode)).size!==d.scores.length||d.scores.some(s=>!content.questions.some(q=>q.code===s.questionCode&&s.marks<=q.marks))))throw new BadRequestException('Enter each question once, with marks between zero and its maximum.');await this.db.$transaction(async tx=>{const changed=await tx.academicPaper.updateMany({where:{id:paperId,revision:d.revision,status:'PUBLISHED'},data:{revision:{increment:1}}});if(!changed.count)throw new ConflictException('Marks changed; reload before saving.');await tx.academicPaperResult.upsert({where:{paperId_enrollmentId:{paperId,enrollmentId:d.enrollmentId}},create:{paperId,enrollmentId:d.enrollmentId,absent:d.absent,scores:d.scores,recordedById:user.id},update:{absent:d.absent,scores:d.scores,recordedById:user.id}});if(paper.homeworkId)await tx.homeworkSubmission.updateMany({where:{homeworkId:paper.homeworkId,enrollmentId:d.enrollmentId},data:{status:d.absent?'PENDING':'GRADED',score:d.absent?null:d.scores.reduce((sum,s)=>sum+s.marks,0)}});if(paper.examSubjectId){const mark={marksObtained:d.absent?null:d.scores.reduce((sum,s)=>sum+s.marks,0),isAbsent:d.absent};await tx.studentMark.upsert({where:{examSubjectId_enrollmentId:{examSubjectId:paper.examSubjectId,enrollmentId:d.enrollmentId}},create:{examSubjectId:paper.examSubjectId,enrollmentId:d.enrollmentId,...mark},update:mark});}});return {updated:true};}

  async evidence(user:any,id:string){const p=await this.program(user,id);const [papers,enrollments,attendance]=await Promise.all([this.db.academicPaper.findMany({where:{programId:id,status:'PUBLISHED'},include:{results:true}}),this.db.studentEnrollment.findMany({where:{...this.classroom(p),status:'ACTIVE'},include:{student:{include:{user:{select:{firstName:true,lastName:true}}}}}}),this.db.studentAttendance.findMany({where:{schoolId:p.schoolId,enrollment:{academicYearId:p.academicYearId,classId:p.classId,sectionId:p.sectionId}}})]);return analyzeEvidence(flattenTopics(parse(dto.curriculumSchema,p.curriculum)),papers,papers.flatMap(paper=>paper.results),enrollments,attendance);}
  async intervention(user:any,id:string,raw:unknown){const p=await this.program(user,id),d=parse(dto.interventionSchema,raw);await this.enrollment(p,d.enrollmentId);if(!flattenTopics(parse(dto.curriculumSchema,p.curriculum)).some(t=>t.code===d.topicCode))throw new BadRequestException('Unknown topic.');return this.db.academicIntervention.create({data:{programId:id,...d,dueDate:date(d.dueDate)}});}
  async closeIntervention(user:any,id:string,interventionId:string,raw:unknown){await this.program(user,id);const d=parse(z.object({outcome:z.string().trim().min(1).max(4000)}).strict(),raw);const changed=await this.db.academicIntervention.updateMany({where:{id:interventionId,programId:id,status:'OPEN'},data:{status:'COMPLETED',outcome:d.outcome}});if(!changed.count)throw new ConflictException('Intervention is missing or already completed.');return {updated:true};}
  async insight(user:any,id:string,raw:unknown){const p=await this.program(user,id),d=parse(dto.insightSchema,raw);if(d.enrollmentId)await this.enrollment(p,d.enrollmentId);const all=await this.evidence(user,id),selected=d.enrollmentId?all.filter(s=>s.enrollmentId===d.enrollmentId):all;
    // Provider receives aggregate statistics or one unnamed child's evidence, never the class roster.
    const evidence=d.audience==='PARENT'?selected.map(({topics,attendance})=>({topics,attendance})):flattenTopics(parse(dto.curriculumSchema,p.curriculum)).map(t=>({topic:t.title,students:selected.length,needsSupport:selected.filter(s=>s.topics.some(x=>x.topicCode===t.code&&x.status==='NEEDS_SUPPORT')).length,noEvidence:selected.filter(s=>s.topics.some(x=>x.topicCode===t.code&&x.status==='NO_EVIDENCE')).length}));
    const result=await this.generate(user,`${d.audience}_SUMMARY`,{audience:d.audience,evidence},'Summarize only the supplied evidence for the requested audience. Return {summary,strengths:string[],needsSupport:string[],nextSteps:string[],limitations}. A score below 60 percent is a teaching flag, not a diagnosis. Do not infer ability, disability or causes from attendance. Explicitly distinguish no evidence from low marks. Suggest practical teacher-reviewed next steps. Never invent results or compare named children.',dto.summarySchema);
    return this.db.academicInsight.create({data:{programId:id,audience:d.audience,enrollmentId:d.enrollmentId,content:result.content,evidence:evidence as any,generationId:result.generationId}});
  }
  async reviewInsight(user:any,id:string,insightId:string,raw:unknown){await this.program(user,id);const d=parse(z.object({revision:z.number().int(),content:dto.summarySchema}).strict(),raw);const changed=await this.db.academicInsight.updateMany({where:{id:insightId,programId:id,revision:d.revision,status:'DRAFT'},data:{content:d.content,reviewedAt:new Date(),revision:{increment:1}}});if(!changed.count)throw new ConflictException('Summary changed or is already published.');return {updated:true};}
  async publishInsight(user:any,id:string,insightId:string,raw:unknown){await this.program(user,id);const d=parse(dto.revisionSchema,raw);const changed=await this.db.academicInsight.updateMany({where:{id:insightId,programId:id,revision:d.revision,status:'DRAFT',reviewedAt:{not:null}},data:{status:'PUBLISHED',publishedAt:new Date(),revision:{increment:1}}});if(!changed.count)throw new ConflictException('Save a reviewed summary before publishing, then reload.');return {updated:true};}
  async parentInsights(user:any,enrollmentId:string){
    const enrollment=await this.db.studentEnrollment.findFirst({where:{id:enrollmentId,student:{studentParents:{some:{status:'ACTIVE',canViewAcademics:true,parent:{userId:user.id}}}}}});
    if(!enrollment)throw new ForbiddenException('You cannot view this child.');
    return this.db.academicInsight.findMany({where:{enrollmentId,audience:'PARENT',status:'PUBLISHED',program:{schoolId:enrollment.schoolId,academicYearId:enrollment.academicYearId,classId:enrollment.classId,sectionId:enrollment.sectionId!}},select:{id:true,content:true,publishedAt:true,program:{select:{name:true}}},orderBy:{publishedAt:'desc'}});
  }
}
