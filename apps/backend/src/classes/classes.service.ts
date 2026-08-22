import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateClassesBulkDto, CreateSchoolClassDto, SchoolClassStatus, UpdateSchoolClassDto } from './classes.dto';

@Injectable()
export class SchoolClassesService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(schoolId: string | null, status?: string) {
    this.requireSchoolId(schoolId);
    const classStatus = this.parseStatus(status);
    return this.prisma.schoolClass.findMany({
      where: { schoolId, ...(classStatus ? { status: classStatus } : {}) },
      include: { school: true, academicYear: true, sections: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  async findOne(id: string, schoolId: string | null) {
    this.requireSchoolId(schoolId);
    const schoolClass = await this.prisma.schoolClass.findUnique({
      where: { id },
      include: { school: true, academicYear: true, sections: true },
    });

    if (!schoolClass) {
      throw new NotFoundException(`Class with id ${id} not found`);
    }
    this.assertSchoolAccess(schoolClass.schoolId, schoolId);

    return schoolClass;
  }

  findBySchool(schoolId: string, actorSchoolId: string | null, status?: string) {
    this.requireSchoolId(actorSchoolId);
    this.assertSchoolAccess(schoolId, actorSchoolId);
    const classStatus = this.parseStatus(status);
    return this.prisma.schoolClass.findMany({
      where: { schoolId, ...(classStatus ? { status: classStatus } : {}) },
      include: { school: true, academicYear: true, sections: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  async create(schoolId: string | null, data: CreateSchoolClassDto) {
    this.requireSchoolId(schoolId);
    this.validateSectionCount(data.numberOfSections);
    this.validateStatus(data.status);
    const subjectIds = this.validateSubjectIds(data.subjectIds ?? []);

    const school = await this.prisma.school.findUnique({ where: { id: schoolId } });
    if (!school) {
      throw new NotFoundException(`School with id ${schoolId} not found`);
    }

    const academicYear = await this.prisma.academicYear.findFirst({
      where: { id: data.academicYearId, schoolId },
    });
    if (!academicYear) {
      throw new NotFoundException('Academic year not found for your school.');
    }
    await this.validateActiveSubjects(schoolId, subjectIds);

    return this.prisma.$transaction(async (tx) => {
      const schoolClass = await tx.schoolClass.create({
        data: {
          schoolId,
          academicYearId: data.academicYearId,
          name: data.name,
          code: data.code ?? null,
          capacity: data.capacity ?? null,
          status: data.status ?? 'ACTIVE',
        },
      });

      const sectionCount = data.numberOfSections ?? 0;
      if (sectionCount > 0) {
        await tx.section.createMany({
          data: Array.from({ length: sectionCount }, (_, index) => ({
            schoolId,
            classId: schoolClass.id,
            name: String(index + 1),
            capacity: data.sectionCapacity ?? null,
            status: 'ACTIVE',
          })),
        });
      }
      if (subjectIds.length) {
        await tx.classSubject.createMany({
          data: subjectIds.map((subjectId) => ({ schoolId, academicYearId: data.academicYearId, classId: schoolClass.id, subjectId })),
        });
      }

      return tx.schoolClass.findUniqueOrThrow({
        where: { id: schoolClass.id },
        include: { school: true, academicYear: true, sections: { orderBy: { name: 'asc' } }, classSubjects: { include: { subject: true } } },
      });
    });
  }

  async createBulk(schoolId: string | null, data: CreateClassesBulkDto) {
    this.requireSchoolId(schoolId);
    if (!Number.isInteger(data.numberOfSections) || data.numberOfSections < 1) {
      throw new BadRequestException('numberOfSections must be a whole number greater than zero.');
    }

    const academicYear = await this.prisma.academicYear.findFirst({
      where: { id: data.academicYearId, schoolId },
    });
    if (!academicYear) {
      throw new NotFoundException('Academic year not found for your school.');
    }

    const classNames = this.getStandardClassNames(data);
    if (classNames.length === 0) {
      throw new BadRequestException('Select at least one class group: montessori, primary, secondary, or seniorSecondary.');
    }
    const existingClasses = await this.prisma.schoolClass.findMany({
      where: {
        schoolId,
        academicYearId: data.academicYearId,
        name: { in: classNames },
      },
      select: { name: true },
    });
    if (existingClasses.length > 0) {
      throw new BadRequestException(
        `Classes already exist for this academic year: ${existingClasses.map((schoolClass) => schoolClass.name).join(', ')}.`,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const createdClasses = [];

      for (const className of classNames) {
        const schoolClass = await tx.schoolClass.create({
          data: {
            schoolId,
            academicYearId: data.academicYearId,
            name: className,
            status: 'ACTIVE',
          },
        });

        await tx.section.createMany({
          data: Array.from({ length: data.numberOfSections }, (_, index) => ({
            schoolId,
            classId: schoolClass.id,
            name: String(index + 1),
            capacity: data.sectionCapacity ?? null,
            status: 'ACTIVE',
          })),
        });

        createdClasses.push(schoolClass.id);
      }

      const classes = await tx.schoolClass.findMany({
        where: { id: { in: createdClasses } },
        include: { academicYear: true, sections: { orderBy: { name: 'asc' } } },
        orderBy: { createdAt: 'asc' },
      });

      return {
        message: `${classes.length} classes and ${classes.length * data.numberOfSections} sections created successfully`,
        academicYearId: data.academicYearId,
        classes,
      };
    });
  }

  async update(id: string, schoolId: string | null, data: UpdateSchoolClassDto) {
    await this.findOne(id, schoolId);
    this.validateStatus(data.status);
    if (data.academicYearId) {
      const academicYear = await this.prisma.academicYear.findFirst({
        where: { id: data.academicYearId, schoolId: schoolId! },
      });
      if (!academicYear) throw new NotFoundException('Academic year not found for your school.');
    }

    return this.prisma.schoolClass.update({
      where: { id },
      data: {
        ...(data.academicYearId !== undefined ? { academicYearId: data.academicYearId } : {}),
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.code !== undefined ? { code: data.code } : {}),
        ...(data.capacity !== undefined ? { capacity: data.capacity } : {}),
        ...(data.status !== undefined ? { status: data.status } : {}),
      },
      include: { school: true, academicYear: true, sections: true },
    });
  }

  async remove(id: string, schoolId: string | null) {
    await this.findOne(id, schoolId);

    return this.prisma.schoolClass.delete({ where: { id } });
  }

  async findSubjects(schoolId: string | null, academicYearId: string, classId: string) {
    this.requireSchoolId(schoolId);
    await this.assertClassScope(schoolId, academicYearId, classId);
    const mappings = await this.prisma.classSubject.findMany({
      where: { schoolId, academicYearId, classId },
      include: { subject: true },
      orderBy: { subject: { name: 'asc' } },
    });
    return { academicYearId, classId, subjects: mappings.map((mapping) => mapping.subject) };
  }

  async availableSubjects(schoolId: string | null, academicYearId: string, classId: string) {
    this.requireSchoolId(schoolId);
    await this.assertClassScope(schoolId, academicYearId, classId);
    const [subjects, assigned] = await Promise.all([
      this.prisma.subject.findMany({ where: { schoolId, status: 'ACTIVE' }, orderBy: { name: 'asc' } }),
      this.prisma.classSubject.findMany({ where: { schoolId, academicYearId, classId }, select: { subjectId: true } }),
    ]);
    const assignedIds = new Set(assigned.map((item) => item.subjectId));
    return subjects.map((subject) => ({ ...subject, isAssigned: assignedIds.has(subject.id) }));
  }

  async replaceSubjects(schoolId: string | null, academicYearId: string, classId: string, data: { subjectIds: string[] }) {
    this.requireSchoolId(schoolId);
    await this.assertClassScope(schoolId, academicYearId, classId);
    const subjectIds = this.validateSubjectIds(data.subjectIds);
    await this.validateActiveSubjects(schoolId, subjectIds);
    const existing = await this.prisma.classSubject.findMany({ where: { schoolId, academicYearId, classId }, select: { subjectId: true } });
    const current = new Set(existing.map((item) => item.subjectId));
    const desired = new Set(subjectIds);
    const removed = [...current].filter((id) => !desired.has(id));
    const added = subjectIds.filter((id) => !current.has(id));
    if (removed.length) await this.assertSubjectsUnused(schoolId, academicYearId, classId, removed);
    await this.prisma.$transaction(async (tx) => {
      if (removed.length) await tx.classSubject.deleteMany({ where: { schoolId, academicYearId, classId, subjectId: { in: removed } } });
      if (added.length) await tx.classSubject.createMany({ data: added.map((subjectId) => ({ schoolId, academicYearId, classId, subjectId })) });
    });
    return this.findSubjects(schoolId, academicYearId, classId);
  }

  async validateSubjectAssignedToClass(schoolId: string, academicYearId: string, classId: string, subjectId: string) {
    const assignment = await this.prisma.classSubject.findFirst({ where: { schoolId, academicYearId, classId, subjectId } });
    if (!assignment) throw new BadRequestException('Subject is not assigned to the selected class for this academic year.');
    return assignment;
  }

  private async assertClassScope(schoolId: string, academicYearId: string, classId: string) {
    const [year, schoolClass] = await Promise.all([
      this.prisma.academicYear.findFirst({ where: { id: academicYearId, schoolId } }),
      this.prisma.schoolClass.findFirst({ where: { id: classId, schoolId, academicYearId } }),
    ]);
    if (!year) throw new NotFoundException('Academic year not found for your school.');
    if (!schoolClass) throw new BadRequestException('Class must belong to the selected academic year.');
  }

  private validateSubjectIds(value: unknown): string[] {
    if (!Array.isArray(value)) throw new BadRequestException('subjectIds must be an array.');
    if (value.some((id) => typeof id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id))) throw new BadRequestException('Every subjectId must be a UUID v4.');
    if (new Set(value).size !== value.length) throw new BadRequestException('subjectIds must not contain duplicates.');
    return value;
  }

  private async validateActiveSubjects(schoolId: string, subjectIds: string[]) {
    if (!subjectIds.length) return;
    const subjects = await this.prisma.subject.findMany({ where: { id: { in: subjectIds }, schoolId } });
    if (subjects.length !== subjectIds.length) throw new BadRequestException('Every subject must belong to your school.');
    const inactive = subjects.filter((subject) => subject.status !== 'ACTIVE');
    if (inactive.length) throw new BadRequestException(`Only active subjects can be assigned: ${inactive.map((subject) => subject.name).join(', ')}.`);
  }

  private async assertSubjectsUnused(schoolId: string, academicYearId: string, classId: string, subjectIds: string[]) {
    const [teachers, timetable, exams] = await Promise.all([
      this.prisma.teacherAcademicAssignment.count({ where: { schoolId, academicYearId, classId, subjectId: { in: subjectIds } } }),
      this.prisma.timetableEntry.count({ where: { schoolId, academicYearId, classId, subjectId: { in: subjectIds } } }),
      this.prisma.examSubject.count({ where: { classId, subjectId: { in: subjectIds }, exam: { schoolId, academicYearId } } }),
    ]);
    const dependencies = [...(teachers ? ['teacher assignments'] : []), ...(timetable ? ['timetable entries'] : []), ...(exams ? ['exams or marks'] : [])];
    if (dependencies.length) throw new ConflictException(`Cannot remove the selected subjects because they are used by ${dependencies.join(', ')}. Remove those academic records first.`);
  }

  private requireSchoolId(schoolId: string | null): asserts schoolId is string {
    if (!schoolId) throw new ForbiddenException('A school-admin account must be assigned to a school.');
  }

  private assertSchoolAccess(resourceSchoolId: string, actorSchoolId: string) {
    if (resourceSchoolId !== actorSchoolId) {
      throw new ForbiddenException('You can only access classes for your own school.');
    }
  }

  private validateSectionCount(sectionCount?: number) {
    if (!Number.isInteger(sectionCount ?? 0) || (sectionCount ?? 0) < 0) {
      throw new BadRequestException('numberOfSections must be a non-negative whole number.');
    }
  }

  private validateStatus(status?: string): asserts status is SchoolClassStatus | undefined {
    if (status !== undefined && status !== 'ACTIVE' && status !== 'INACTIVE') {
      throw new BadRequestException('Class status must be ACTIVE or INACTIVE.');
    }
  }

  private parseStatus(status?: string): SchoolClassStatus | undefined {
    this.validateStatus(status);
    return status;
  }

  private getStandardClassNames(data: CreateClassesBulkDto) {
    const montessori = data.montessori ? ['Play School', 'Nursery', 'LKG', 'UKG'] : [];
    const primary = data.primary ? this.getStandardRange(1, 5) : [];
    const secondary = data.secondary ? this.getStandardRange(6, 10) : [];
    const seniorSecondary = data.seniorSecondary ? this.getStandardRange(11, 12) : [];
    return [...montessori, ...primary, ...secondary, ...seniorSecondary];
  }

  private getStandardRange(start: number, end: number) {
    return Array.from({ length: end - start + 1 }, (_, index) => `${this.ordinal(start + index)} Standard`);
  }

  private ordinal(value: number) {
    const remainder = value % 100;
    if (remainder >= 11 && remainder <= 13) return `${value}th`;
    const suffix = value % 10 === 1 ? 'st' : value % 10 === 2 ? 'nd' : value % 10 === 3 ? 'rd' : 'th';
    return `${value}${suffix}`;
  }
}
