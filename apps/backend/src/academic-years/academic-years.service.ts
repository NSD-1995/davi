import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAcademicYearDto, UpdateAcademicYearDto } from './academic-years.dto';

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
