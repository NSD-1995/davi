import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTeacherAssignmentDto, CreateTeacherDto, UpdateTeacherDto } from './teachers.dto';

@Injectable()
export class TeachersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(schoolId: string | null) {
    this.requireSchool(schoolId);
    const teachers = await this.prisma.teacher.findMany({
      where: { schoolId },
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
    const staff = await this.prisma.staff.findFirst({ where: { userId: data.userId, schoolId } });
    if (!staff) throw new NotFoundException('A Staff profile must exist before creating a Teacher profile.');
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
    this.requireSchool(schoolId); await this.findOne(teacherId, schoolId);
    const academicYear = await this.prisma.academicYear.findFirst({ where: { id: data.academicYearId, schoolId } }); if (!academicYear) throw new NotFoundException('Academic year not found for your school.');
    const schoolClass = await this.prisma.schoolClass.findFirst({ where: { id: data.classId, schoolId, academicYearId: data.academicYearId } }); if (!schoolClass) throw new BadRequestException('Class must belong to the selected academic year.');
    if (data.sectionId && !await this.prisma.section.findFirst({ where: { id: data.sectionId, schoolId, classId: data.classId } })) throw new BadRequestException('Section must belong to the selected class.');
    if (data.isClassTeacher && !data.sectionId) throw new BadRequestException('A class-teacher assignment requires a section.');
    if (data.subjectId && !await this.prisma.classSubject.findFirst({ where: { academicYearId: data.academicYearId, classId: data.classId, subjectId: data.subjectId, schoolId } })) throw new BadRequestException('Subject is not assigned to the selected class for this academic year.');
    if (!data.subjectId && !data.isClassTeacher) throw new BadRequestException('Select a subject or mark the teacher as class teacher.');
    const duplicate = await this.prisma.teacherAcademicAssignment.findFirst({ where: { teacherId, academicYearId: data.academicYearId, classId: data.classId, sectionId: data.sectionId ?? null, subjectId: data.subjectId ?? null, isClassTeacher: data.isClassTeacher ?? false } });
    if (duplicate) throw new ConflictException('This teacher academic assignment already exists.');
    try { return await this.prisma.teacherAcademicAssignment.create({ data: { schoolId, teacherId, academicYearId: data.academicYearId, classId: data.classId, sectionId: data.sectionId ?? null, subjectId: data.subjectId ?? null, isClassTeacher: data.isClassTeacher ?? false }, include: { academicYear: true, schoolClass: true, section: true, subject: true } }); } catch (error: unknown) { if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002') throw new ConflictException('A class teacher is already assigned to this section.'); throw error; }
  }
  async findAssignments(teacherId: string, schoolId: string | null) { this.requireSchool(schoolId); await this.findOne(teacherId, schoolId); return this.prisma.teacherAcademicAssignment.findMany({ where: { teacherId, schoolId }, include: { academicYear: true, schoolClass: true, section: true, subject: true }, orderBy: { createdAt: 'desc' } }); }
  async removeAssignment(teacherId: string, assignmentId: string, schoolId: string | null) { this.requireSchool(schoolId); await this.findOne(teacherId, schoolId); const assignment = await this.prisma.teacherAcademicAssignment.findFirst({ where: { id: assignmentId, teacherId, schoolId } }); if (!assignment) throw new NotFoundException('Teacher academic assignment not found.'); return this.prisma.teacherAcademicAssignment.delete({ where: { id: assignmentId } }); }
  async replaceClassTeacher(schoolId: string | null, academicYearId: string, classId: string, sectionId: string, teacherId: string) {
    this.requireSchool(schoolId); await this.assertAcademicScope(schoolId, academicYearId, classId, sectionId); await this.findOne(teacherId, schoolId);
    try { return await this.prisma.$transaction(async tx => { await tx.teacherAcademicAssignment.deleteMany({ where: { schoolId, academicYearId, classId, sectionId, isClassTeacher: true } }); return tx.teacherAcademicAssignment.create({ data: { schoolId, academicYearId, classId, sectionId, teacherId, isClassTeacher: true }, include: { teacher: { include: { user: { select: { id: true, firstName: true, lastName: true } } } }, academicYear: true, schoolClass: true, section: true } }); }); }
    catch (error: unknown) { if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002') throw new ConflictException('A class teacher is already assigned to this section.'); throw error; }
  }
  async getClassTeacher(schoolId: string | null, academicYearId: string, classId: string, sectionId: string) { this.requireSchool(schoolId); await this.assertAcademicScope(schoolId, academicYearId, classId, sectionId); return this.prisma.teacherAcademicAssignment.findFirst({ where: { schoolId, academicYearId, classId, sectionId, isClassTeacher: true }, include: { teacher: { include: { user: { select: { id: true, firstName: true, lastName: true } } } } } }); }
  async removeClassTeacher(schoolId: string | null, academicYearId: string, classId: string, sectionId: string) { this.requireSchool(schoolId); await this.assertAcademicScope(schoolId, academicYearId, classId, sectionId); return this.prisma.teacherAcademicAssignment.deleteMany({ where: { schoolId, academicYearId, classId, sectionId, isClassTeacher: true } }); }
  private async assertAcademicScope(schoolId: string, academicYearId: string, classId: string, sectionId: string) { const year = await this.prisma.academicYear.findFirst({ where: { id: academicYearId, schoolId } }); if (!year) throw new NotFoundException('Academic year not found for your school.'); const schoolClass = await this.prisma.schoolClass.findFirst({ where: { id: classId, schoolId, academicYearId } }); if (!schoolClass) throw new BadRequestException('Class must belong to the selected academic year.'); const section = await this.prisma.section.findFirst({ where: { id: sectionId, schoolId, classId } }); if (!section) throw new BadRequestException('Section must belong to the selected class.'); }
  private requireSchool(schoolId: string | null): asserts schoolId is string { if (!schoolId) throw new ForbiddenException('A school account is required.'); }
  private safe(teacher: any) { if (teacher.user) teacher.user.passwordHash = undefined; return teacher; }
}
