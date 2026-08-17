import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AssignAcademicYearSubjectsDto, CreateAcademicYearDto, UpdateAcademicYearDto } from './academic-years.dto';

@Injectable()
export class AcademicYearsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(schoolId: string | null) {
    this.requireSchoolId(schoolId);

    return this.prisma.academicYear.findMany({
      where: { schoolId },
      include: { school: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  async findOne(id: string, schoolId: string | null) {
    this.requireSchoolId(schoolId);

    const academicYear = await this.prisma.academicYear.findUnique({
      where: { id },
      include: { school: true },
    });

    if (!academicYear) {
      throw new NotFoundException(`Academic year with id ${id} not found`);
    }

    this.assertSchoolAccess(academicYear.schoolId, schoolId);

    return academicYear;
  }

  findBySchool(schoolId: string, actorSchoolId: string | null) {
    this.requireSchoolId(actorSchoolId);
    this.assertSchoolAccess(schoolId, actorSchoolId);

    return this.prisma.academicYear.findMany({
      where: { schoolId },
      include: { school: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  async create(schoolId: string | null, data: CreateAcademicYearDto) {
    this.requireSchoolId(schoolId);

    const school = await this.prisma.school.findUnique({ where: { id: schoolId } });
    if (!school) {
      throw new NotFoundException(`School with id ${schoolId} not found`);
    }

    return this.prisma.academicYear.create({
      data: {
        schoolId,
        name: data.name,
        startDate: data.startDate ? new Date(data.startDate) : null,
        endDate: data.endDate ? new Date(data.endDate) : null,
        isCurrent: data.isCurrent ?? false,
        status: data.status ?? 'ACTIVE',
      },
    });
  }

  async update(id: string, schoolId: string | null, data: UpdateAcademicYearDto) {
    await this.findOne(id, schoolId);

    return this.prisma.academicYear.update({
      where: { id },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.startDate !== undefined ? { startDate: new Date(data.startDate) } : {}),
        ...(data.endDate !== undefined ? { endDate: new Date(data.endDate) } : {}),
        ...(data.isCurrent !== undefined ? { isCurrent: data.isCurrent } : {}),
        ...(data.status !== undefined ? { status: data.status } : {}),
      },
    });
  }

  async remove(id: string, schoolId: string | null) {
    await this.findOne(id, schoolId);

    return this.prisma.academicYear.delete({ where: { id } });
  }

  async assignSubjects(id: string, schoolId: string | null, data: AssignAcademicYearSubjectsDto) {
    this.requireSchoolId(schoolId);
    if (!data.schoolId) throw new BadRequestException('schoolId is required.');
    this.assertSchoolAccess(data.schoolId, schoolId);
    if (!Array.isArray(data.subjectIds) || data.subjectIds.length === 0) throw new BadRequestException('subjectIds must contain at least one subject id.');
    const subjectIds = [...new Set(data.subjectIds)];
    if (subjectIds.some((subjectId) => typeof subjectId !== 'string' || !subjectId.trim())) throw new BadRequestException('Every subjectId must be a non-empty string.');
    const academicYear = await this.prisma.academicYear.findUnique({ where: { id } });
    if (!academicYear) throw new NotFoundException(`Academic year with id ${id} not found`);
    this.assertSchoolAccess(academicYear.schoolId, schoolId);
    const subjects = await this.prisma.subject.findMany({ where: { id: { in: subjectIds } } });
    if (subjects.length !== subjectIds.length) throw new NotFoundException('One or more subjects were not found.');
    if (subjects.some((subject) => subject.schoolId !== schoolId)) throw new ForbiddenException('Every subject must belong to the same school as the academic year.');
    const existing = await this.prisma.academicYearSubject.findMany({ where: { academicYearId: id, subjectId: { in: subjectIds } }, select: { subjectId: true } });
    if (existing.length) throw new ConflictException(`Subjects already assigned to this academic year: ${existing.map((item) => item.subjectId).join(', ')}.`);
    return this.prisma.$transaction(async (tx) => {
      await tx.academicYearSubject.createMany({ data: subjectIds.map((subjectId) => ({ schoolId, academicYearId: id, subjectId })) });
      return tx.subject.findMany({ where: { id: { in: subjectIds } }, orderBy: { name: 'asc' } });
    });
  }

  async findSubjects(id: string, schoolId: string | null) {
    const academicYear = await this.findOne(id, schoolId);
    const mappings = await this.prisma.academicYearSubject.findMany({ where: { academicYearId: id }, include: { subject: true }, orderBy: { subject: { name: 'asc' } } });
    return { academicYear: { id: academicYear.id, name: academicYear.name }, subjects: mappings.map((mapping) => mapping.subject) };
  }

  async removeSubject(id: string, subjectId: string, schoolId: string | null) {
    await this.findOne(id, schoolId);
    const mapping = await this.prisma.academicYearSubject.findUnique({ where: { academicYearId_subjectId: { academicYearId: id, subjectId } } });
    if (!mapping) throw new NotFoundException('Subject is not assigned to this academic year.');
    await this.prisma.academicYearSubject.delete({ where: { academicYearId_subjectId: { academicYearId: id, subjectId } } });
    return { message: 'Subject removed from academic year.', academicYearId: id, subjectId };
  }

  private requireSchoolId(schoolId: string | null): asserts schoolId is string {
    if (!schoolId) {
      throw new ForbiddenException('A school-admin account must be assigned to a school.');
    }
  }

  private assertSchoolAccess(resourceSchoolId: string, actorSchoolId: string) {
    if (resourceSchoolId !== actorSchoolId) {
      throw new ForbiddenException('You can only access academic years for your own school.');
    }
  }
}
