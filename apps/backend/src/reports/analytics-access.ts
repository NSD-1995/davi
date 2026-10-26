import { historicalScope } from './analytics-cohort';
import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { OperationsAccessService } from '../auth/operations-access.service';
import { AnalyticsFilters } from './analytics-filters';
@Injectable()
export class AnalyticsAccess {
 constructor(private db:PrismaService,private operations:OperationsAccessService){}
 async authorize(user:any,f:AnalyticsFilters,client:any=this.db){
  const actor=await this.operations.actor(user.schoolId,user.id,'REPORT_VIEW',client),s=actor.schoolId;
  const year=await client.academicYear.findFirst({where:{id:f.academicYearId,schoolId:s}});if(!year)throw new BadRequestException('Academic year is outside your school.');
  const assignments=await client.teacherAcademicAssignment.findMany({where:{schoolId:s,academicYearId:year.id,isActive:true,teacher:{userId:user.id,status:'ACTIVE'}},select:{classId:true,sectionId:true,subjectId:true,isClassTeacher:true}});
  const wide=actor.admin||actor.scope?.schoolWide===true;
  const branches:any[]=wide?[{}]:[...assignments.map((a:any)=>({classId:a.classId,...(a.sectionId?{sectionId:a.sectionId}:{})})),...(actor.scope?.classIds||[]).map((classId:string)=>({classId})),...(actor.scope?.sectionIds||[]).map((sectionId:string)=>({sectionId}))];
  if(!branches.length)throw new ForbiddenException('No authorized academic classes. Ask an administrator to assign your report scope.');
  const scope={schoolId:s,academicYearId:year.id,...(f.classId?{classId:f.classId}:{}),...(f.sectionId?{sectionId:f.sectionId}:{})};
  if(f.classId&&!await client.schoolClass.findFirst({where:{id:f.classId,schoolId:s,academicYearId:year.id}}))throw new BadRequestException('Class is outside this academic year.');
  if(f.sectionId&&!await client.section.findFirst({where:{id:f.sectionId,classId:f.classId,schoolId:s}}))throw new BadRequestException('Section is outside this class.');
  if(!wide&&f.classId&&!branches.some(b=>(!b.classId||b.classId===f.classId)&&(!f.sectionId||!b.sectionId||b.sectionId===f.sectionId)))throw new ForbiddenException('Class or section is outside your report scope.');
  if(f.subjectId&&!await client.subject.findFirst({where:{id:f.subjectId,schoolId:s}}))throw new BadRequestException('Subject is outside your school.');
  if(f.examId&&!await client.exam.findFirst({where:{id:f.examId,schoolId:s,academicYearId:year.id}}))throw new BadRequestException('Exam is outside this academic year.');
  let teacherBranches:any[]|undefined,teacherAcademicBranches:any[]|undefined;
  if(f.teacherId){const a=await client.teacherAcademicAssignment.findMany({where:{schoolId:s,academicYearId:year.id,teacherId:f.teacherId,isActive:true,teacher:{schoolId:s}},select:{classId:true,sectionId:true,subjectId:true}});if(!a.length)throw new BadRequestException('Teacher has no assignments in this academic year.');teacherBranches=a.map((r:any)=>({classId:r.classId,...(r.sectionId?{sectionId:r.sectionId}:{})}));teacherAcademicBranches=a.map((r:any)=>({classId:r.classId,...(r.sectionId?{sectionId:r.sectionId}:{}),...(r.subjectId?{subjectId:r.subjectId}:{})}));}
  const enrollmentWhere={schoolId:s,academicYearId:year.id,...(f.enrollmentStatus==='ACTIVE'?{status:'ACTIVE'}:{}),...(f.enrollmentId?{id:f.enrollmentId}:{}),AND:[historicalScope({classId:f.classId,sectionId:f.sectionId}),{OR:branches.map(historicalScope)},...(teacherBranches?[{OR:teacherBranches.map(historicalScope)}]:[])]};
  if(f.enrollmentId&&!await client.studentEnrollment.findFirst({where:{...enrollmentWhere,status:undefined}}))throw new ForbiddenException('Student is outside the selected authorized scope.');
  const academicBranches:any[]=wide||actor.scope?.classIds?.length||actor.scope?.sectionIds?.length?branches:assignments.map((a:any)=>({classId:a.classId,...(a.sectionId?{sectionId:a.sectionId}:{}),...(!a.isClassTeacher&&a.subjectId?{subjectId:a.subjectId}:{})}));
  const can=(code:string)=>actor.admin||actor.permissions.has(code);
  const capabilities={attendance:can('ATTENDANCE_VIEW'),homework:can('HOMEWORK_VIEW'),exams:can('MARKS_VIEW'),lessons:can('LESSON_PLAN_VIEW'),staff:wide&&can('STAFF_VIEW'),staffAttendance:wide&&can('staff.attendance.view'),admissions:wide&&can('ADMISSIONS_VIEW'),attention:can('REPORT_ATTENTION_VIEW'),attentionManage:can('REPORT_ATTENTION_MANAGE'),export:can('REPORT_EXPORT'),ai:can('AI_GENERATE'),fees:false};
  const permissionKey=createHash('sha256').update(JSON.stringify({wide,branches,academicBranches,codes:[...actor.permissions].sort(),admin:actor.admin})).digest('hex');
  return {actor,year,wide,scope,enrollmentWhere,branches,academicBranches,teacherAcademicBranches,capabilities,permissionKey,can};
 }
}
