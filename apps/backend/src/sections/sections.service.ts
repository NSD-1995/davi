import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSectionDto, UpdateSectionDto } from './sections.dto';

@Injectable()
export class SectionsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(schoolId: string | null) {
    this.requireSchoolId(schoolId);
    return this.prisma.section.findMany({
      where: { schoolId },
      include: { school: true, schoolClass: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  async findOne(id: string, schoolId: string | null) {
    this.requireSchoolId(schoolId);
    const section = await this.prisma.section.findUnique({
      where: { id },
      include: { school: true, schoolClass: true },
    });

    if (!section) {
      throw new NotFoundException(`Section with id ${id} not found`);
    }
    this.assertSchoolAccess(section.schoolId, schoolId);

    return section;
  }

  findBySchool(schoolId: string, actorSchoolId: string | null) {
    this.requireSchoolId(actorSchoolId);
    this.assertSchoolAccess(schoolId, actorSchoolId);
    return this.prisma.section.findMany({
      where: { schoolId },
      include: { school: true, schoolClass: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  async findByClass(classId: string, schoolId: string | null) {
    this.requireSchoolId(schoolId);
    const schoolClass = await this.prisma.schoolClass.findUnique({ where: { id: classId } });
    if (!schoolClass) throw new NotFoundException(`Class with id ${classId} not found`);
    this.assertSchoolAccess(schoolClass.schoolId, schoolId);
    return this.prisma.section.findMany({
      where: { classId },
      include: { school: true, schoolClass: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  async create(schoolId: string | null, data: CreateSectionDto) {
    this.requireSchoolId(schoolId);
    const schoolClass = await this.prisma.schoolClass.findUnique({ where: { id: data.classId } });
    if (!schoolClass) {
      throw new NotFoundException(`Class with id ${data.classId} not found`);
    }
    this.assertSchoolAccess(schoolClass.schoolId, schoolId);
    if (schoolClass.status !== 'ACTIVE') {
      throw new BadRequestException('Cannot create a section for an inactive class. Reactivate the class first.');
    }

    return this.prisma.section.create({
      data: {
        schoolId,
        classId: data.classId,
        name: data.name,
        capacity: data.capacity ?? null,
        status: data.status ?? 'ACTIVE',
      },
      include: { school: true, schoolClass: true },
    });
  }

  async update(id: string, schoolId: string | null, data: UpdateSectionDto) {
    await this.findOne(id, schoolId);

    return this.prisma.section.update({
      where: { id },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.capacity !== undefined ? { capacity: data.capacity } : {}),
        ...(data.status !== undefined ? { status: data.status } : {}),
      },
      include: { school: true, schoolClass: true },
    });
  }

  async remove(id: string, schoolId: string | null) {
    await this.findOne(id, schoolId);

    return this.prisma.section.delete({ where: { id } });
  }

  private requireSchoolId(schoolId: string | null): asserts schoolId is string {
    if (!schoolId) throw new ForbiddenException('A school-admin account must be assigned to a school.');
  }

  private assertSchoolAccess(resourceSchoolId: string, actorSchoolId: string) {
    if (resourceSchoolId !== actorSchoolId) {
      throw new ForbiddenException('You can only access sections for your own school.');
    }
  }
}
