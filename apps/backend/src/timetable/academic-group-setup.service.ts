import {BadRequestException,ForbiddenException,Injectable} from '@nestjs/common';
import {Prisma} from '@prisma/client';
import {PrismaService} from '../prisma/prisma.service';
import {ACADEMIC_GROUPS,academicGroup,subjectInGroup,validGroups} from '../academic-groups';
import {responsibilityRows,teachingExclusion} from '../teaching-responsibilities';
import {TeachersService} from '../teachers/teachers.service';
import {TimetableRulesService} from './timetable-rules.service';

@Injectable()
export class AcademicGroupSetupService {
 constructor(private readonly db:PrismaService){}
 private school(s:string|null):asserts s is string{if(!s)throw new ForbiddenException('A school account is required.');}
 async workspace(s:string|null,yearId:string,groupId:string){
  this.school(s);if(!validGroups([groupId]))throw new BadRequestException('Choose a valid academic group.');
  const data=await new TimetableRulesService(this.db).simpleSetup(s,yearId);
  const classes=data.classes.filter(c=>academicGroup(c)===groupId).map(c=>({...c,sections:c.sections.filter(section=>section.status==='ACTIVE')}));
  const subjects=data.subjects.filter(subject=>subjectInGroup(subject,groupId));
  const [allocations,timings]=await Promise.all([
   this.db.teacherAcademicAssignment.findMany({where:{schoolId:s,academicYearId:yearId,classId:{in:classes.map(c=>c.id)},isClassTeacher:true,isActive:true}}),
   this.db.periodTemplateAssignment.findMany({where:{schoolId:s,academicYearId:yearId,classId:{in:classes.map(c=>c.id)},isActive:true,effectiveFrom:{lte:new Date()},OR:[{effectiveTo:null},{effectiveTo:{gte:new Date()}}],template:{status:'ACTIVE'}},include:{template:{include:{slots:true}}}}),
  ]);
  const issues:Array<{classId:string;sectionId?:string;message:string;severity:'error'|'warning';href:string}>=[];
  for(const c of classes){
   const mappings=data.mappings.filter(m=>m.classId===c.id),link='/academics/classes';
   if(!c.sections.length)issues.push({classId:c.id,message:c.name+': add a section.',severity:'error',href:link});
   if(!mappings.length)issues.push({classId:c.id,message:c.name+': assign subjects.',severity:'error',href:link});
   for(const section of c.sections){
    const href=`/academics/workspace/${c.id}/sections/${section.id}?year=${yearId}`;
    const template=timings.find(t=>t.classId===c.id&&t.sectionId===section.id)||timings.find(t=>t.classId===c.id&&!t.sectionId);
    if(!template)issues.push({classId:c.id,sectionId:section.id,message:`${c.name} / ${section.name}: assign active school timings.`,severity:'error',href:'/academics/period-templates'});
    const ct=allocations.find(a=>a.sectionId===section.id);
    if(!ct)issues.push({classId:c.id,sectionId:section.id,message:`${c.name} / ${section.name}: class teacher is missing.`,severity:data.rules.classTeacherRequired||data.rules.classTeacherFirstPeriodPriority==='MANDATORY'?'error':'warning',href});
    else if(!data.teachers.some(t=>t.id===ct.teacherId&&!teachingExclusion(t,c.id,c)))issues.push({classId:c.id,sectionId:section.id,message:`${c.name} / ${section.name}: class teacher is outside group responsibility or inactive.`,severity:'error',href});
    for(const m of mappings){const subject=data.subjects.find(subject=>subject.id===m.subjectId);
     if(!subject||!subjectInGroup(subject,groupId)){issues.push({classId:c.id,sectionId:section.id,message:`${c.name}: subject is inactive or outside this group.`,severity:'error',href:link});continue;}
     const eligible=data.teachers.filter(t=>!teachingExclusion(t,c.id,c,m.subjectId)&&(!m.eligibleTeacherIds.length||m.eligibleTeacherIds.includes(t.id)));
     if(!eligible.length)issues.push({classId:c.id,sectionId:section.id,message:`${c.name} / ${section.name}: no responsible teacher for ${subject.name}.`,severity:'error',href});
    }
    if(template&&data.rules.allocationMode==='CUSTOM'){
     const capacity=template.template.slots.filter(slot=>slot.type==='TEACHING'||slot.type==='SUBJECT').reduce((n,slot)=>n+slot.applicableDays.filter(day=>template.template.workingDays.includes(day)).length,0);
     if(mappings.reduce((n,m)=>n+m.requiredPeriodsPerWeek,0)>capacity)issues.push({classId:c.id,sectionId:section.id,message:`${c.name} / ${section.name}: weekly lessons exceed teaching slots.`,severity:'error',href});
    }
   }
  }
  return{subjectsWithoutGroups:data.subjects.filter(subject=>!subject.academicGroups.length),teachersWithoutGroups:data.teachers.filter(t=>!(t.timetableEligibility as any)?.academicGroups?.length&&!Array.isArray((t.timetableEligibility as any)?.groupResponsibilities)),group:ACADEMIC_GROUPS.find(g=>g.id===groupId),classes,subjects,mappings:data.mappings.filter(m=>classes.some(c=>c.id===m.classId)),teachers:data.teachers,issues,ready:classes.length>0&&!issues.some(i=>i.severity==='error'),ungroupedSubjects:data.subjects.filter(s=>!s.academicGroups.length).length,ungroupedTeachers:data.teachers.filter(t=>!(t.timetableEligibility as any)?.academicGroups?.length&&!Array.isArray((t.timetableEligibility as any)?.groupResponsibilities)).length};
 }
 async save(s:string|null,d:any){
  this.school(s);if(!validGroups([d.groupId])||!Array.isArray(d.assignments)||d.assignments.some((a:any)=>!a||typeof a.teacherId!=='string'||!Array.isArray(a.subjectIds)||(a.classIds!==null&&!Array.isArray(a.classIds))||typeof a.canSubstitute!=='boolean')||new Set(d.assignments.map((a:any)=>a.teacherId)).size!==d.assignments.length)throw new BadRequestException('Provide unique teacher responsibilities for this group.');
  return this.db.$transaction(async tx=>{
   const client:any=new Proxy(tx,{get(target,key){if(key==='$transaction')return(callback:any)=>callback(client);return Reflect.get(target,key);}});
   const service=new TeachersService(client);
   const [subjects,classes,year]=await Promise.all([tx.subject.findMany({where:{schoolId:s!,status:'ACTIVE'}}),tx.schoolClass.findMany({where:{schoolId:s!}}),tx.academicYear.findFirst({where:{schoolId:s!,id:d.academicYearId,status:'ACTIVE'}})]);
   if(!year)throw new BadRequestException('Select an active academic year in your school.');
   for(const assignment of d.assignments){
    const teacher=await service.findOne(assignment.teacherId,s);
    if(teacher.status!=='ACTIVE')throw new BadRequestException('Choose active teachers.');
    const previous=responsibilityRows(teacher,subjects,classes);
    const rows=[...previous.filter(r=>r.groupId!==d.groupId),...(assignment.subjectIds.length?[{groupId:d.groupId,subjectIds:assignment.subjectIds,classIds:assignment.classIds}]:[])];
    const policy=(teacher.timetableEligibility||{}) as any;
    await service.saveTeachingSetup(teacher.id,s,{groupResponsibilities:rows,allowedClassIds:policy.allowedClassIds??null,preferredClassIds:policy.preferredClassIds||[],canSubstitute:assignment.canSubstitute});
   }
   return{saved:true};
  },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});
 }
 async classifySubjects(s:string|null,d:any){
  this.school(s);
  if(!validGroups(d.academicGroups)||!d.academicGroups.length||!Array.isArray(d.subjectIds)||!d.subjectIds.length||d.subjectIds.some((id:unknown)=>typeof id!=='string')||new Set(d.subjectIds).size!==d.subjectIds.length)throw new BadRequestException('Select subjects and valid academic groups.');
  return this.db.$transaction(async tx=>{
   const subjects=await tx.subject.findMany({where:{schoolId:s!,id:{in:d.subjectIds},status:'ACTIVE'}});
   if(subjects.length!==d.subjectIds.length)throw new BadRequestException('Every subject must be active and belong to your school.');
   await tx.subject.updateMany({where:{schoolId:s!,id:{in:d.subjectIds}},data:{academicGroups:d.academicGroups}});
   return{saved:true};
  },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});
 }
}
