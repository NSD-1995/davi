import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
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

      return tx.schoolClass.findUniqueOrThrow({
        where: { id: schoolClass.id },
        include: { school: true, academicYear: true, sections: { orderBy: { name: 'asc' } } },
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
