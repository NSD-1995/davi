import {responsibilityError,teachingExclusion} from '../teaching-responsibilities';
import {validGroups,academicGroup,subjectInGroup} from '../academic-groups';
import {allowedForClass} from '../timetable/teacher-eligibility';
import { Prisma } from '@prisma/client';
import { assertClassTeacherAvailable } from './class-teacher-assignment';
import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTeacherAssignmentDto, CreateTeacherDto, UpdateTeacherDto } from './teachers.dto';

@Injectable()
export class TeachersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(schoolId: string | null) {
    this.requireSchool(schoolId);
    const teachers = await this.prisma.teacher.findMany({
      where: {
        schoolId,
        status: 'ACTIVE',
        user: { status: 'ACTIVE', staff: { is: { status: 'ACTIVE' } } },
      },
      include: {
        user: true,
        school: true,
      },
    });
    return teachers.map((teacher) => this.safe(teacher));
  }

  async findOne(id: string, schoolId: string | null) {
    this.requireSchool(schoolId);
    const teacher = await this.prisma.teacher.findUnique({
      where: { id },
      include: {
        user: true,
        school: true,
      },
    });

    if (!teacher) {
      throw new NotFoundException(`Teacher with id ${id} not found`);
    }
    if (teacher.schoolId !== schoolId) throw new ForbiddenException('You can only access teachers from your own school.');

    return this.safe(teacher);
  }

  async create(schoolId: string | null, data: CreateTeacherDto) {
    this.requireSchool(schoolId);
    if (data.schoolId !== schoolId) throw new ForbiddenException('You can only create teachers for your own school.');
    const staff = await this.prisma.staff.findFirst({ where: { userId: data.userId, schoolId, status: 'ACTIVE', user: { status: 'ACTIVE' } } });
    if (!staff) throw new NotFoundException('An active Staff profile must exist before creating a Teacher profile.');
    return this.prisma.teacher.create({
      data: {
        ...data,
        hireDate: data.hireDate ? new Date(data.hireDate) : null,
        status: data.status ?? 'ACTIVE',
      },
    });
  }

  async update(id: string, schoolId: string | null, data: UpdateTeacherDto) {
    await this.findOne(id, schoolId);
    if (data.schoolId !== undefined && data.schoolId !== schoolId) throw new ForbiddenException('A teacher cannot be moved to another school.');

    return this.prisma.teacher.update({
      where: { id },
      data: {
        ...data,
        ...(data.hireDate ? { hireDate: new Date(data.hireDate) } : {}),
        ...(data.status ? { status: data.status } : {}),
      },
    });
  }

  async remove(id: string, schoolId: string | null) {
    await this.findOne(id, schoolId);

    return this.prisma.teacher.delete({ where: { id } });
  }
  async assignAcademics(teacherId: string, schoolId: string | null, data: CreateTeacherAssignmentDto) {
    this.requireSchool(schoolId);const candidate=await this.findOne(teacherId,schoolId);const teachingClass=await this.prisma.schoolClass.findFirst({where:{id:data.classId,schoolId}});if(candidate.status!=='ACTIVE'||!allowedForClass(candidate,data.classId,teachingClass||undefined))throw new BadRequestException('Select an active teacher allowed to teach this class.');if(data.subjectId&&teachingExclusion(candidate,data.classId,teachingClass||{},data.subjectId))throw new BadRequestException('Teacher capability and group subject responsibility are required for this subject.');
    const academicYear = await this.prisma.academicYear.findFirst({ where: { id: data.academicYearId, schoolId } }); if (!academicYear) throw new NotFoundException('Academic year not found for your school.');
    const schoolClass = await this.prisma.schoolClass.findFirst({ where: { id: data.classId, schoolId, academicYearId: data.academicYearId } }); if (!schoolClass) throw new BadRequestException('Class must belong to the selected academic year.');
    if (data.sectionId && !await this.prisma.section.findFirst({ where: { id: data.sectionId, schoolId, classId: data.classId } })) throw new BadRequestException('Section must belong to the selected class.');
    if (data.isClassTeacher && !data.sectionId) throw new BadRequestException('A class-teacher assignment requires a section.');
    if (data.subjectId && !await this.prisma.classSubject.findFirst({ where: { academicYearId: data.academicYearId, classId: data.classId, subjectId: data.subjectId, schoolId } })) throw new BadRequestException('Subject is not assigned to the selected class for this academic year.');
    if (!data.subjectId && !data.isClassTeacher) throw new BadRequestException('Select a subject or mark the teacher as class teacher.');
    if (data.isClassTeacher) await assertClassTeacherAvailable(this.prisma, schoolId, data.academicYearId, teacherId, data.classId, data.sectionId ?? null);
    const duplicate = await this.prisma.teacherAcademicAssignment.findFirst({ where: { teacherId, academicYearId: data.academicYearId, classId: data.classId, sectionId: data.sectionId ?? null, subjectId: data.subjectId ?? null, isClassTeacher: data.isClassTeacher ?? false } });
    if (duplicate) throw new ConflictException('This teacher academic assignment already exists.');
    try { return await this.prisma.teacherAcademicAssignment.create({ data: { schoolId, teacherId, academicYearId: data.academicYearId, classId: data.classId, sectionId: data.sectionId ?? null, subjectId: data.subjectId ?? null, isClassTeacher: data.isClassTeacher ?? false }, include: { academicYear: true, schoolClass: true, section: true, subject: true } }); } catch (error: unknown) { if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002') throw new ConflictException('A class teacher is already assigned to this section.'); throw error; }
  }
  async findAssignments(teacherId: string, schoolId: string | null) { this.requireSchool(schoolId); await this.findOne(teacherId, schoolId); return this.prisma.teacherAcademicAssignment.findMany({ where: { teacherId, schoolId }, include: { academicYear: true, schoolClass: true, section: true, subject: true }, orderBy: { createdAt: 'desc' } }); }
  async removeSubjectAssignment(teacherId:string,assignmentId:string,schoolId:string|null){
    this.requireSchool(schoolId);await this.findOne(teacherId,schoolId);
    return this.prisma.$transaction(async tx=>{
      const assignment=await tx.teacherAcademicAssignment.findFirst({where:{id:assignmentId,teacherId,schoolId,subjectId:{not:null},isActive:true}});
      if(!assignment)throw new NotFoundException('Active subject assignment not found for this teacher.');
      const used=await tx.timetableEntry.count({where:{schoolId,academicYearId:assignment.academicYearId,classId:assignment.classId,teacherId,subjectId:assignment.subjectId!,...(assignment.sectionId?{sectionId:assignment.sectionId}:{})}});
      if(used)throw new ConflictException('This subject assignment is used by '+used+' timetable lesson(s). Reassign or delete those timetable lessons before removing it.');
      return tx.teacherAcademicAssignment.update({where:{id:assignmentId},data:assignment.isClassTeacher?{subjectId:null,assignmentRole:null,responsibilityType:'LEAD_TEACHER'}:{isActive:false,endDate:new Date()}});
    },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});
  }
  async removeAssignment(teacherId:string,assignmentId:string,schoolId:string|null){
    this.requireSchool(schoolId);await this.findOne(teacherId,schoolId);
    const assignment=await this.prisma.teacherAcademicAssignment.findFirst({where:{id:assignmentId,teacherId,schoolId}});
    if(!assignment)throw new NotFoundException('Teacher academic assignment not found.');
    if(assignment.subjectId)return this.removeSubjectAssignment(teacherId,assignmentId,schoolId);
    return this.prisma.teacherAcademicAssignment.delete({where:{id:assignmentId}});
  }

  async saveTeachingSetup(teacherId:string,schoolId:string|null,d:any){
    this.requireSchool(schoolId);
    if(d.groupResponsibilities!==undefined){
      const [subjects,classes]=await Promise.all([this.prisma.subject.findMany({where:{schoolId,status:'ACTIVE'}}),this.prisma.schoolClass.findMany({where:{schoolId}})]);
      const error=responsibilityError(d.groupResponsibilities,subjects,classes);if(error)throw new BadRequestException(error);
      d={...d,academicGroups:d.groupResponsibilities.map((r:any)=>r.groupId),subjectIds:[...new Set(d.groupResponsibilities.flatMap((r:any)=>r.subjectIds))]};
    }
    if(d.academicGroups!==undefined&&!validGroups(d.academicGroups))throw new BadRequestException('Choose valid academic groups.');
    if(d.academicGroups?.length){const subjects=await this.prisma.subject.findMany({where:{schoolId,id:{in:d.subjectIds||[]}}});if(subjects.some(subject=>!d.academicGroups.some((g:string)=>subjectInGroup(subject,g))))throw new BadRequestException('Choose subjects from the teacher academic groups.');}
    return this.prisma.$transaction(async tx=>{
      const client=new Proxy(tx,{get(target,key){if(key==='$transaction')return(callback:any)=>callback(client);return Reflect.get(target,key);}});
      const service=new TeachersService(client as PrismaService);
      const capabilities=await service.saveCapabilities(teacherId,schoolId,d.subjectIds);
      const eligibility=await service.saveEligibility(teacherId,schoolId,d);
      if(d.groupResponsibilities!==undefined){const policy=(eligibility.timetableEligibility||{}) as any;return tx.teacher.update({where:{id:teacherId},data:{timetableEligibility:{...policy,groupResponsibilities:d.groupResponsibilities}},select:{id:true,capableSubjectIds:true,timetableEligibility:true}});}
      return{...capabilities,...eligibility};
    },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});
  }
  async saveEligibility(teacherId:string,schoolId:string|null,d:any){
    this.requireSchool(schoolId);const teacher=await this.findOne(teacherId,schoolId);
    if(typeof d.canSubstitute!=='boolean'||(d.allowedClassIds!==null&&!Array.isArray(d.allowedClassIds))||!Array.isArray(d.preferredClassIds))throw new BadRequestException('Choose allowed classes, preferred classes and substitute availability.');
    if([...(d.allowedClassIds||[]),...d.preferredClassIds].some(id=>typeof id!=='string'))throw new BadRequestException('Class IDs must be valid strings.');
    const allowed=d.allowedClassIds===null?null:[...new Set<string>(d.allowedClassIds)],preferred=[...new Set<string>(d.preferredClassIds)],ids=[...new Set([...(allowed||[]),...preferred])];
    const classes=await this.prisma.schoolClass.findMany({where:{schoolId,id:{in:ids}},select:{id:true}});
    if(classes.length!==ids.length)throw new BadRequestException('Every selected class must belong to this school.');
    if(allowed&&preferred.some(id=>!allowed.includes(id)))throw new BadRequestException('Preferred classes must also be allowed classes.');
    if(d.academicGroups!==undefined&&!validGroups(d.academicGroups))throw new BadRequestException('Choose valid academic groups.');
    const timetableEligibility={...((teacher.timetableEligibility||{}) as any),...(d.academicGroups!==undefined?{academicGroups:d.academicGroups}:{}),canSubstitute:d.canSubstitute,preferredClassIds:preferred,...(allowed?{allowedClassIds:allowed}:{})};if(allowed===null)delete timetableEligibility.allowedClassIds;
    return this.prisma.teacher.update({where:{id:teacherId},data:{timetableEligibility},select:{id:true,timetableEligibility:true}});
  }
  async saveCapabilities(teacherId:string,schoolId:string|null,subjectIds:string[]){
    this.requireSchool(schoolId);const teacher=await this.findOne(teacherId,schoolId);
    if(!Array.isArray(subjectIds)||subjectIds.some(id=>typeof id!=='string'))throw new BadRequestException('Capable subjects must be a list of subject IDs.');
    const ids=[...new Set(subjectIds)];const subjects=await this.prisma.subject.findMany({where:{schoolId,id:{in:ids}},select:{id:true}});
    if(subjects.length!==ids.length)throw new BadRequestException('Every capable subject must belong to this school.');
    return this.prisma.teacher.update({where:{id:teacherId},data:{capableSubjectIds:ids,timetableEligibility:{...((teacher.timetableEligibility||{}) as any),capabilitiesConfigured:true}},select:{id:true,capableSubjectIds:true}});
  }
  async classTeacherOptions(schoolId:string|null,academicYearId:string) {
    this.requireSchool(schoolId);
    if(!await this.prisma.academicYear.findFirst({where:{id:academicYearId,schoolId}}))throw new NotFoundException('Academic year not found for your school.');
    const [teachers,assignments]=await Promise.all([
      this.prisma.teacher.findMany({where:{schoolId,status:'ACTIVE',user:{status:'ACTIVE',staff:{is:{status:'ACTIVE'}}}},select:{id:true,timetableEligibility:true,user:{select:{firstName:true,lastName:true}}},orderBy:{teacherCode:'asc'}}),
      this.prisma.teacherAcademicAssignment.findMany({where:{schoolId,academicYearId,isClassTeacher:true,isActive:true},select:{teacherId:true,classId:true,sectionId:true,schoolClass:{select:{name:true}},section:{select:{name:true}}}}),
    ]);
    return teachers.map(teacher=>({...teacher,classTeacherAssignments:assignments.filter(a=>a.teacherId===teacher.id)}));
  }
  async replaceClassTeacher(schoolId: string | null, academicYearId: string, classId: string, sectionId: string, teacherId: string) {
    this.requireSchool(schoolId); await this.assertAcademicScope(schoolId, academicYearId, classId, sectionId); const candidate=await this.findOne(teacherId, schoolId);if(!allowedForClass(candidate,classId,(((candidate.timetableEligibility||{}) as any).academicGroups?.length?await this.prisma.schoolClass.findFirst({where:{id:classId,schoolId}}):undefined)||undefined))throw new BadRequestException('Teacher is not allowed for this class. Update their allowed classes first.');if(candidate.status!=='ACTIVE'||candidate.user.status!=='ACTIVE'||!await this.prisma.staff.findFirst({where:{userId:candidate.userId,schoolId,status:'ACTIVE'}}))throw new BadRequestException('Select an active teaching staff member.');
    try { return await this.prisma.$transaction(async tx => { await assertClassTeacherAvailable(tx, schoolId, academicYearId, teacherId, classId, sectionId); await tx.teacherAcademicAssignment.updateMany({where:{schoolId,academicYearId,classId,sectionId,isClassTeacher:true,subjectId:null,isActive:true},data:{isActive:false,endDate:new Date()}});await tx.teacherAcademicAssignment.updateMany({where:{schoolId,academicYearId,classId,sectionId,isClassTeacher:true,subjectId:{not:null},isActive:true},data:{isClassTeacher:false}}); return tx.teacherAcademicAssignment.create({ data: { schoolId, academicYearId, classId, sectionId, teacherId, isClassTeacher: true, responsibilityType:'LEAD_TEACHER' }, include: { teacher: { include: { user: { select: { id: true, firstName: true, lastName: true } } } }, academicYear: true, schoolClass: true, section: true } }); }); }
    catch (error: unknown) { if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002') throw new ConflictException('This teacher or section already has an active class teacher assignment. Refresh the teacher list and try again.'); throw error; }
  }
  async getClassTeacher(schoolId: string | null, academicYearId: string, classId: string, sectionId: string) { this.requireSchool(schoolId); await this.assertAcademicScope(schoolId, academicYearId, classId, sectionId); return this.prisma.teacherAcademicAssignment.findFirst({ where: { schoolId, academicYearId, classId, sectionId, isClassTeacher: true, isActive:true }, include: { teacher: { include: { user: { select: { id: true, firstName: true, lastName: true } } } } } }); }
  async removeClassTeacher(schoolId: string | null, academicYearId: string, classId: string, sectionId: string) { this.requireSchool(schoolId); await this.assertAcademicScope(schoolId, academicYearId, classId, sectionId); return this.prisma.teacherAcademicAssignment.deleteMany({ where: { schoolId, academicYearId, classId, sectionId, isClassTeacher: true } }); }
  private async assertAcademicScope(schoolId: string, academicYearId: string, classId: string, sectionId: string) { const year = await this.prisma.academicYear.findFirst({ where: { id: academicYearId, schoolId } }); if (!year) throw new NotFoundException('Academic year not found for your school.'); const schoolClass = await this.prisma.schoolClass.findFirst({ where: { id: classId, schoolId, academicYearId } }); if (!schoolClass) throw new BadRequestException('Class must belong to the selected academic year.'); const section = await this.prisma.section.findFirst({ where: { id: sectionId, schoolId, classId } }); if (!section) throw new BadRequestException('Section must belong to the selected class.'); }
  private requireSchool(schoolId: string | null): asserts schoolId is string { if (!schoolId) throw new ForbiddenException('A school account is required.'); }
  private safe(teacher: any) { if (teacher.user) teacher.user.passwordHash = undefined; return teacher; }
}
