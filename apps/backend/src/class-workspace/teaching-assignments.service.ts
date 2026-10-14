import {teachingExclusion} from '../teaching-responsibilities';
import {academicGroup,subjectInGroup} from '../academic-groups';
import {allowedForClass} from '../timetable/teacher-eligibility';
import { assertClassTeacherAvailable } from '../teachers/class-teacher-assignment';
import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ReplaceSubjectTeachersDto, ReplaceTeachingTeamDto, ResponsibilityType, SubjectAssignmentRole } from './teaching-assignments.dto';

const RESPONSIBILITIES: ResponsibilityType[] = ['LEAD_TEACHER','ASSISTANT_TEACHER','SUBJECT_TEACHER','ACTIVITY_TEACHER','CO_TEACHER','VISITING_TEACHER','SUBSTITUTE_TEACHER'];
const SUBJECT_ROLES: SubjectAssignmentRole[] = ['PRIMARY','SUPPORT','SUBSTITUTE'];

@Injectable()
export class TeachingAssignmentsService {
  constructor(private readonly prisma: PrismaService) {}

  async timetableSetup(schoolId:string|null,yearId:string,classId:string,sectionId:string){
    this.school(schoolId);const schoolClass=await this.scope(schoolId,yearId,classId,sectionId);
    const [subjects,teachers,timings]=await Promise.all([
      this.prisma.classSubject.findMany({where:{schoolId,academicYearId:yearId,classId,isActive:true,subject:{status:'ACTIVE'}},include:{subject:true},orderBy:{displayOrder:'asc'}}),
      this.subjectTeachers(schoolId,yearId,classId,sectionId),
      this.prisma.periodTemplateAssignment.findMany({where:{schoolId,academicYearId:yearId,classId,isActive:true,effectiveFrom:{lte:new Date()},OR:[{effectiveTo:null},{effectiveTo:{gte:new Date()}}],AND:[{OR:[{sectionId},{sectionId:null}]}],template:{status:'ACTIVE'}},include:{template:{include:{slots:true}}},orderBy:{effectiveFrom:'desc'}}),
    ]);
    const timing=timings.find(t=>t.sectionId===sectionId)||timings.find(t=>t.sectionId===null);
    const days=timing?.template.workingDays.length||5,capacity=timing?timing.template.slots.filter(slot=>slot.type==='TEACHING'||slot.type==='SUBJECT').length*days:null;
    return{academicGroup:academicGroup(schoolClass),subjects:subjects.filter(row=>subjectInGroup(row.subject,academicGroup(schoolClass))),assignments:teachers.assignments,workingDays:days,weeklyCapacity:capacity};
  }
  async saveTimetableSetup(schoolId:string|null,yearId:string,classId:string,sectionId:string,d:any){
    this.school(schoolId);const schoolClass=await this.scope(schoolId,yearId,classId,sectionId);
    if(!Array.isArray(d.subjects)||d.subjects.some((r:any)=>typeof r.subjectId!=='string'||!Number.isInteger(r.weeklyPeriods)||r.weeklyPeriods<1))throw new BadRequestException('Every subject needs a positive whole number of weekly periods.');
    if(new Set(d.subjects.map((r:any)=>r.subjectId)).size!==d.subjects.length)throw new BadRequestException('Subject rows cannot be duplicated.');
    return this.prisma.$transaction(async tx=>{
      const client=new Proxy(tx,{get(target,key){if(key==='$transaction')return (callback:any)=>callback(client);return Reflect.get(target,key);}});
      const service=new TeachingAssignmentsService(client as PrismaService);
      const current=await service.timetableSetup(schoolId,yearId,classId,sectionId);
      if(current.subjects.length!==d.subjects.length||d.subjects.some((r:any)=>!current.subjects.some(subject=>subject.subjectId===r.subjectId)))throw new BadRequestException('The class subject list changed. Refresh and try again.');
      const total=d.subjects.reduce((n:number,r:any)=>n+r.weeklyPeriods,0);
      if(current.weeklyCapacity!==null&&total>current.weeklyCapacity)throw new BadRequestException('The class needs '+total+' weekly periods but its timing template provides '+current.weeklyCapacity+'. Reduce the counts or extend the period template.');
      await service.replaceSubjectTeachers(schoolId,yearId,classId,sectionId,{assignments:d.assignments});
      for(const row of d.subjects){const old=current.subjects.find(s=>s.subjectId===row.subjectId)!;await tx.classSubject.update({where:{id:old.id},data:{requiredPeriodsPerWeek:row.weeklyPeriods,maxPeriodsPerDay:Math.max(old.maxPeriodsPerDay,Math.ceil(row.weeklyPeriods/current.workingDays))}});}
      return{saved:true,weeklyPeriods:total};
    },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable,timeout:30000});
  }
  async teachingTeam(schoolId:string|null, yearId:string, classId:string, sectionId:string) {
    this.school(schoolId); await this.scope(schoolId,yearId,classId,sectionId);
    const rows=await this.prisma.teacherAcademicAssignment.findMany({where:{schoolId,academicYearId:yearId,classId,sectionId,subjectId:null,isActive:true},include:{teacher:{include:{user:{include:{staff:true}}}}},orderBy:{createdAt:'asc'}});
    return {academicYearId:yearId,classId,sectionId,members:rows.map(row=>({...row,staffId:row.teacher.user.staff?.id??null}))};
  }

  async replaceTeachingTeam(schoolId:string|null, yearId:string, classId:string, sectionId:string, dto:ReplaceTeachingTeamDto) {
    this.school(schoolId); await this.scope(schoolId,yearId,classId,sectionId);
    if(!Array.isArray(dto.members))throw new BadRequestException('members must be an array.');
    if(dto.members.some(item=>!item.staffId||!RESPONSIBILITIES.includes(item.responsibilityType)))throw new BadRequestException('Every member requires a staffId and valid responsibilityType.');
    const keys=dto.members.map(item=>`${item.staffId}:${item.responsibilityType}`);if(new Set(keys).size!==keys.length)throw new BadRequestException('Teaching-team members must not be duplicated.');
    if(dto.members.filter(item=>item.responsibilityType==='LEAD_TEACHER').length>1)throw new ConflictException('A section can have only one active lead teacher.');
    const resolved=await this.resolveStaff(schoolId,dto.members.map(item=>item.staffId));
    const desired=new Set(dto.members.map(item=>`${resolved.get(item.staffId)!}:${item.responsibilityType}`));
    const existing=await this.prisma.teacherAcademicAssignment.findMany({where:{schoolId,academicYearId:yearId,classId,sectionId,subjectId:null,isActive:true}});
    const removed=existing.filter(row=>!desired.has(`${row.teacherId}:${row.responsibilityType}`));
    await this.assertTeamRemovalSafe(schoolId,yearId,classId,sectionId,removed.map(row=>row.teacherId));
    await this.prisma.$transaction(async tx=>{
      for (const member of dto.members) if (member.responsibilityType === 'LEAD_TEACHER') await assertClassTeacherAvailable(tx, schoolId, yearId, resolved.get(member.staffId)!, classId, sectionId);
      if(removed.length)await tx.teacherAcademicAssignment.updateMany({where:{id:{in:removed.map(row=>row.id)}},data:{isActive:false,endDate:new Date()}});
      for(const member of dto.members){const teacherId=resolved.get(member.staffId)!;const old=await tx.teacherAcademicAssignment.findFirst({where:{schoolId,academicYearId:yearId,classId,sectionId,teacherId,subjectId:null,responsibilityType:member.responsibilityType}});if(old)await tx.teacherAcademicAssignment.update({where:{id:old.id},data:{isActive:true,endDate:null,isClassTeacher:member.responsibilityType==='LEAD_TEACHER'}});else await tx.teacherAcademicAssignment.create({data:{schoolId,academicYearId:yearId,classId,sectionId,teacherId,responsibilityType:member.responsibilityType,isClassTeacher:member.responsibilityType==='LEAD_TEACHER',isActive:true}});}
    });
    return this.teachingTeam(schoolId,yearId,classId,sectionId);
  }

  async subjectTeachers(schoolId:string|null,yearId:string,classId:string,sectionId:string){this.school(schoolId);const schoolClass=await this.scope(schoolId,yearId,classId,sectionId);const rows=await this.prisma.teacherAcademicAssignment.findMany({where:{schoolId,academicYearId:yearId,classId,sectionId,subjectId:{not:null},isActive:true},include:{subject:true,teacher:{include:{user:{include:{staff:true}}}}},orderBy:{createdAt:'asc'}});return{academicYearId:yearId,classId,sectionId,assignments:rows.map(row=>({...row,staffId:row.teacher.user.staff?.id??null}))};}

  async replaceSubjectTeachers(schoolId:string|null,yearId:string,classId:string,sectionId:string,dto:ReplaceSubjectTeachersDto){this.school(schoolId);const schoolClass=await this.scope(schoolId,yearId,classId,sectionId);if(!Array.isArray(dto.assignments))throw new BadRequestException('assignments must be an array.');if(dto.assignments.some(item=>!item.staffId||!item.subjectId||!SUBJECT_ROLES.includes(item.assignmentRole)))throw new BadRequestException('Every assignment requires subjectId, staffId, and a valid assignmentRole.');const keys=dto.assignments.map(item=>`${item.subjectId}:${item.staffId}:${item.assignmentRole}`);if(new Set(keys).size!==keys.length)throw new BadRequestException('Subject-teacher assignments must not be duplicated.');const primary=dto.assignments.filter(item=>item.assignmentRole==='PRIMARY').map(item=>item.subjectId);if(new Set(primary).size!==primary.length)throw new ConflictException('A subject can have only one active primary teacher in a section.');const subjectIds=[...new Set(dto.assignments.map(item=>item.subjectId))];const classSubjects=await this.prisma.classSubject.count({where:{schoolId,academicYearId:yearId,classId,subjectId:{in:subjectIds},isActive:true}});if(classSubjects!==subjectIds.length)throw new BadRequestException('Every subject must be assigned to the selected class for this academic year.');const resolved=await this.resolveStaff(schoolId,dto.assignments.map(item=>item.staffId));const capableTeachers=await this.prisma.teacher.findMany({where:{schoolId,id:{in:[...resolved.values()]},status:'ACTIVE'},select:{id:true,capableSubjectIds:true,timetableEligibility:true}});for(const item of dto.assignments)if(!capableTeachers.some(t=>t.id===resolved.get(item.staffId)&&!teachingExclusion(t,classId,schoolClass,item.subjectId)))throw new BadRequestException('Selected teacher is not capable of this subject. Update Capable subjects in the teacher profile first.');const assignedSubjects=await this.prisma.classSubject.findMany({where:{schoolId,academicYearId:yearId,classId,subjectId:{in:subjectIds},isActive:true},include:{subject:true}});if(assignedSubjects.some(row=>!subjectInGroup(row.subject,academicGroup(schoolClass))))throw new BadRequestException('Subject is outside this class academic group.');const desired=new Set(dto.assignments.map(item=>`${item.subjectId}:${resolved.get(item.staffId)!}:${item.assignmentRole}`));const existing=await this.prisma.teacherAcademicAssignment.findMany({where:{schoolId,academicYearId:yearId,classId,sectionId,subjectId:{not:null},isActive:true}});const removed=existing.filter(row=>!desired.has(`${row.subjectId}:${row.teacherId}:${row.assignmentRole}`));const replacementBySubject=new Map(dto.assignments.filter(item=>item.assignmentRole==='PRIMARY').map(item=>[item.subjectId,resolved.get(item.staffId)!]));await this.assertSubjectRemovalSafe(schoolId,yearId,classId,sectionId,removed.filter(row=>!row.subjectId||!replacementBySubject.has(row.subjectId)));try{await this.prisma.$transaction(async tx=>{for(const row of removed){if(row.subjectId){const replacementTeacherId=replacementBySubject.get(row.subjectId);if(replacementTeacherId&&replacementTeacherId!==row.teacherId)await tx.timetableEntry.updateMany({where:{schoolId,academicYearId:yearId,classId,sectionId,subjectId:row.subjectId,teacherId:row.teacherId},data:{teacherId:replacementTeacherId}});}}if(removed.length)await tx.teacherAcademicAssignment.updateMany({where:{id:{in:removed.map(row=>row.id)}},data:{isActive:false,endDate:new Date()}});for(const item of dto.assignments){const teacherId=resolved.get(item.staffId)!;const old=await tx.teacherAcademicAssignment.findFirst({where:{schoolId,academicYearId:yearId,classId,sectionId,subjectId:item.subjectId,teacherId,assignmentRole:item.assignmentRole}});if(old)await tx.teacherAcademicAssignment.update({where:{id:old.id},data:{isActive:true,endDate:null}});else await tx.teacherAcademicAssignment.create({data:{schoolId,academicYearId:yearId,classId,sectionId,subjectId:item.subjectId,teacherId,responsibilityType:'SUBJECT_TEACHER',assignmentRole:item.assignmentRole,isActive:true}});}});}catch(error){if(error instanceof Prisma.PrismaClientKnownRequestError&&error.code==='P2002')throw new ConflictException('The replacement teacher already has a timetable entry in one of these periods.');throw error;}return this.subjectTeachers(schoolId,yearId,classId,sectionId);}

  async workload(schoolId:string|null,yearId:string,staffId:string){this.school(schoolId);const staff=await this.prisma.staff.findFirst({where:{id:staffId,schoolId},include:{user:{include:{teacher:true}}}});if(!staff?.user.teacher)throw new NotFoundException('Active teaching staff member not found.');const teacherId=staff.user.teacher.id;const [team,subjects,periods]=await Promise.all([this.prisma.teacherAcademicAssignment.count({where:{schoolId,academicYearId:yearId,teacherId,subjectId:null,isActive:true}}),this.prisma.teacherAcademicAssignment.findMany({where:{schoolId,academicYearId:yearId,teacherId,subjectId:{not:null},isActive:true},select:{assignmentRole:true}}),this.prisma.timetableEntry.count({where:{schoolId,academicYearId:yearId,teacherId}})]);return{staffId,academicYearId:yearId,teamResponsibilities:team,subjectAssignments:subjects.length,primarySubjects:subjects.filter(x=>x.assignmentRole==='PRIMARY').length,supportSubjects:subjects.filter(x=>x.assignmentRole==='SUPPORT').length,weeklyTimetablePeriods:periods};}

  private async resolveStaff(schoolId:string,ids:string[]){const unique=[...new Set(ids)];const rows=await this.prisma.staff.findMany({where:{id:{in:unique},schoolId,status:'ACTIVE'},include:{user:{include:{teacher:true}}}});if(rows.length!==unique.length||rows.some(row=>row.user.status!=='ACTIVE'||!row.user.teacher||row.user.teacher.status!=='ACTIVE'))throw new BadRequestException('Every assignment requires active, teaching-eligible staff from your school.');return new Map(rows.map(row=>[row.id,row.user.teacher!.id]));}
  private async scope(schoolId:string,yearId:string,classId:string,sectionId:string){const [year,schoolClass,section]=await Promise.all([this.prisma.academicYear.findFirst({where:{id:yearId,schoolId}}),this.prisma.schoolClass.findFirst({where:{id:classId,schoolId,academicYearId:yearId}}),this.prisma.section.findFirst({where:{id:sectionId,schoolId,classId}})]);if(!year)throw new NotFoundException('Academic year not found for your school.');if(!schoolClass)throw new BadRequestException('Class must belong to the selected academic year.');if(!section)throw new BadRequestException('Section must belong to the selected class.');return schoolClass;}
  private async assertTeamRemovalSafe(schoolId:string,yearId:string,classId:string,sectionId:string,teacherIds:string[]){if(teacherIds.length&&await this.prisma.timetableEntry.count({where:{schoolId,academicYearId:yearId,classId,sectionId,teacherId:{in:teacherIds}}}))throw new ConflictException('Cannot remove teaching-team members referenced by timetable entries. Remove or reassign those entries first.');}
  private async assertSubjectRemovalSafe(schoolId:string,yearId:string,classId:string,sectionId:string,rows:Array<{teacherId:string;subjectId:string|null}>){if(!rows.length)return;const used=await this.prisma.timetableEntry.count({where:{schoolId,academicYearId:yearId,classId,sectionId,OR:rows.filter(row=>row.subjectId).map(row=>({teacherId:row.teacherId,subjectId:row.subjectId!}))}});if(used)throw new ConflictException('Cannot remove subject-teacher assignments referenced by timetable entries. Remove or reassign those entries first.');}
  private school(value:string|null):asserts value is string{if(!value)throw new ForbiddenException('A school account is required.');}
}
