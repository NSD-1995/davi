import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateStudentDto, EnrollStudentDto, UpdateStudentDto, UpdateStudentEnrollmentDto } from './students.dto';

@Injectable()
export class StudentsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(schoolId: string | null) {
    this.requireSchool(schoolId);
    const students = await this.prisma.student.findMany({
      where: { schoolId },
      include: {
        user: true,
        school: true,
        studentParents: { include: { parent: true } },
      },
    });
    return students.map((student) => this.safe(student));
  }

  async findOne(id: string, schoolId: string | null) {
    this.requireSchool(schoolId);
    const student = await this.prisma.student.findUnique({
      where: { id },
      include: {
        user: true,
        school: true,
        studentParents: { include: { parent: true } },
      },
    });

    if (!student) {
      throw new NotFoundException(`Student with id ${id} not found`);
    }
    if (student.schoolId !== schoolId) throw new ForbiddenException('You can only access students from your own school.');

    return this.safe(student);
  }

  async create(schoolId: string | null, data: CreateStudentDto) {
    this.requireSchool(schoolId);
    if (data.schoolId !== schoolId) throw new ForbiddenException('You can only create students for your own school.');
    const user = await this.prisma.user.findFirst({ where: { id: data.userId, schoolId } });
    if (!user) throw new NotFoundException('User not found for your school.');
    return this.prisma.student.create({
      data: {
        ...data,
        birthDate: data.birthDate ? new Date(data.birthDate) : null,
        status: data.status ?? 'ACTIVE',
      },
    });
  }

  async update(id: string, schoolId: string | null, data: UpdateStudentDto) {
    await this.findOne(id, schoolId);
    if (data.schoolId !== undefined && data.schoolId !== schoolId) throw new ForbiddenException('A student cannot be moved to another school.');

    return this.prisma.student.update({
      where: { id },
      data: {
        ...data,
        ...(data.birthDate ? { birthDate: new Date(data.birthDate) } : {}),
        ...(data.status ? { status: data.status } : {}),
      },
    });
  }

  async remove(id: string, schoolId: string | null) {
    await this.findOne(id, schoolId);

    return this.prisma.student.delete({ where: { id } });
  }

  async enroll(studentId: string, schoolId: string | null, data: EnrollStudentDto) {
    this.requireSchool(schoolId);
    await this.findOne(studentId, schoolId);
    const academicYear = await this.prisma.academicYear.findFirst({ where: { id: data.academicYearId, schoolId } });
    if (!academicYear) throw new NotFoundException('Academic year not found for your school.');
    const schoolClass = await this.prisma.schoolClass.findFirst({ where: { id: data.classId, schoolId, academicYearId: data.academicYearId } });
    if (!schoolClass) throw new BadRequestException('Class must belong to the selected academic year and school.');
    const section = await this.prisma.section.findFirst({ where: { id: data.sectionId, schoolId, classId: data.classId } });
    if (!section) throw new BadRequestException('Section must belong to the selected class and school.');
    const existing = await this.prisma.studentEnrollment.findUnique({ where: { studentId_academicYearId: { studentId, academicYearId: data.academicYearId } } });
    if (existing) throw new ConflictException('Student is already enrolled for this academic year.');
    return this.prisma.studentEnrollment.create({ data: { schoolId, studentId, academicYearId: data.academicYearId, classId: data.classId, sectionId: data.sectionId, rollNumber: data.rollNumber?.trim() || null }, include: { academicYear: true, schoolClass: true, section: true } });
  }

  async findEnrollments(studentId: string, schoolId: string | null) {
    this.requireSchool(schoolId); await this.findOne(studentId, schoolId);
    return this.prisma.studentEnrollment.findMany({ where: { studentId, schoolId }, include: { academicYear: true, schoolClass: true, section: true }, orderBy: { createdAt: 'desc' } });
  }

  async updateEnrollment(studentId: string, enrollmentId: string, schoolId: string | null, data: UpdateStudentEnrollmentDto) {
    this.requireSchool(schoolId); await this.findOne(studentId, schoolId);
    const enrollment = await this.prisma.studentEnrollment.findFirst({ where: { id: enrollmentId, studentId, schoolId } });
    if (!enrollment) throw new NotFoundException('Student enrollment not found.');
    const classId = data.classId ?? enrollment.classId; const sectionId = data.sectionId ?? enrollment.sectionId;
    const schoolClass = await this.prisma.schoolClass.findFirst({ where: { id: classId, schoolId, academicYearId: enrollment.academicYearId } });
    if (!schoolClass) throw new BadRequestException('Class must belong to the enrollment academic year.');
    const section = await this.prisma.section.findFirst({ where: { id: sectionId, schoolId, classId } });
    if (!section) throw new BadRequestException('Section must belong to the selected class.');
    return this.prisma.studentEnrollment.update({ where: { id: enrollmentId }, data: { ...(data.classId !== undefined ? { classId } : {}), ...(data.sectionId !== undefined ? { sectionId } : {}), ...(data.rollNumber !== undefined ? { rollNumber: data.rollNumber.trim() || null } : {}), ...(data.status !== undefined ? { status: data.status } : {}) }, include: { academicYear: true, schoolClass: true, section: true } });
  }

  private requireSchool(schoolId: string | null): asserts schoolId is string { if (!schoolId) throw new ForbiddenException('A school account is required.'); }
  private safe(student: any) { if (student.user) student.user.passwordHash = undefined; return student; }
}
