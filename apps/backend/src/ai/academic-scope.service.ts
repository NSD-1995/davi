import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AcademicScopeService {
  constructor(private readonly prisma: PrismaService) {}
  async assert(user: any, scope: {schoolId:string;academicYearId:string;classId:string;subjectId:string}) {
    if (!user.schoolId || scope.schoolId !== user.schoolId) throw new ForbiddenException('School access denied.');
    const [year, schoolClass, subject, assignment] = await Promise.all([
      this.prisma.academicYear.findFirst({where:{id:scope.academicYearId,schoolId:scope.schoolId}}),
      this.prisma.schoolClass.findFirst({where:{id:scope.classId,schoolId:scope.schoolId,academicYearId:scope.academicYearId,status:'ACTIVE'}}),
      this.prisma.subject.findFirst({where:{id:scope.subjectId,schoolId:scope.schoolId,status:'ACTIVE'}}),
      this.prisma.classSubject.findFirst({where:{schoolId:scope.schoolId,academicYearId:scope.academicYearId,classId:scope.classId,subjectId:scope.subjectId,isActive:true}}),
    ]);
    if (!year || !schoolClass || !subject || !assignment) throw new BadRequestException('Invalid academic year, class, subject, or class-subject assignment.');
    const roleCodes = (user.roles || []).map((r:string)=>r.toUpperCase().replace(/-/g,'_'));
    if (roleCodes.includes('SCHOOL_ADMIN')) return {schoolClass,subject};
    const teacher = await this.prisma.teacher.findFirst({where:{userId:user.id,schoolId:scope.schoolId,status:'ACTIVE'}});
    if (!teacher || !await this.prisma.teacherAcademicAssignment.findFirst({where:{schoolId:scope.schoolId,academicYearId:scope.academicYearId,classId:scope.classId,subjectId:scope.subjectId,teacherId:teacher.id,isActive:true}})) throw new ForbiddenException('Teacher is not assigned to this class and subject.');
    return {schoolClass,subject};
  }
}
