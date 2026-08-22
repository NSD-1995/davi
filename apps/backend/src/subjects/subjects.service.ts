import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSubjectDto, SubjectStatus, SubjectType, UpdateSubjectDto } from './subjects.dto';

@Injectable()
export class SubjectsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(schoolId: string | null, status?: string) {
    this.requireSchoolId(schoolId);
    const parsedStatus = this.parseStatus(status);
    return this.prisma.subject.findMany({
      where: { schoolId, ...(parsedStatus ? { status: parsedStatus } : {}) }, include: { school: true }, orderBy: { createdAt: 'asc' },
    });
  }

  async findOne(id: string, schoolId: string | null) {
    this.requireSchoolId(schoolId);
    const subject = await this.prisma.subject.findUnique({ where: { id }, include: { school: true } });
    if (!subject) throw new NotFoundException(`Subject with id ${id} not found`);
    this.assertSchoolAccess(subject.schoolId, schoolId);
    return subject;
  }

  findBySchool(schoolId: string, actorSchoolId: string | null, status?: string) {
    this.requireSchoolId(actorSchoolId);
    this.assertSchoolAccess(schoolId, actorSchoolId);
    const parsedStatus = this.parseStatus(status);
    return this.prisma.subject.findMany({
      where: { schoolId, ...(parsedStatus ? { status: parsedStatus } : {}) }, include: { school: true }, orderBy: { createdAt: 'asc' },
    });
  }

  async create(schoolId: string | null, data: CreateSubjectDto) {
    this.requireSchoolId(schoolId);
    if (!data.schoolId) throw new BadRequestException('schoolId is required.');
    this.assertSchoolAccess(data.schoolId, schoolId);
    const name = this.requiredValue(data.name, 'name');
    const code = this.requiredValue(data.code, 'code').toUpperCase();
    this.validateStatus(data.status);
    this.validateType(data.type);
    const school = await this.prisma.school.findUnique({ where: { id: schoolId } });
    if (!school) throw new NotFoundException(`School with id ${schoolId} not found`);
    await this.ensureUnique(schoolId, name, code);
    try {
      return await this.prisma.subject.create({
        data: { schoolId, name, code, description: data.description ?? null, type: data.type ?? 'CORE', status: data.status ?? 'ACTIVE' },
        include: { school: true },
      });
    } catch (error) { this.rethrowUnique(error); }
  }

  async update(id: string, schoolId: string | null, data: UpdateSubjectDto) {
    const subject = await this.findOne(id, schoolId);
    this.validateStatus(data.status);
    this.validateType(data.type);
    const name = data.name === undefined ? subject.name : this.requiredValue(data.name, 'name');
    const code = data.code === undefined ? subject.code : this.requiredValue(data.code, 'code').toUpperCase();
    await this.ensureUnique(subject.schoolId, name, code, id);
    try {
      return await this.prisma.subject.update({
        where: { id },
        data: {
          ...(data.name !== undefined ? { name } : {}), ...(data.code !== undefined ? { code } : {}),
          ...(data.description !== undefined ? { description: data.description } : {}),
          ...(data.type !== undefined ? { type: data.type } : {}), ...(data.status !== undefined ? { status: data.status } : {}),
        }, include: { school: true },
      });
    } catch (error) { this.rethrowUnique(error); }
  }

  async remove(id: string, schoolId: string | null) {
    await this.findOne(id, schoolId);
    const assignments = await this.prisma.academicYearSubject.count({ where: { subjectId: id } });
    const classAssignments = await this.prisma.classSubject.count({ where: { subjectId: id } });
    if (assignments > 0 || classAssignments > 0) throw new ConflictException('Subject is assigned to one or more academic years or classes. Remove those assignments or set the subject status to INACTIVE.');
    return this.prisma.subject.delete({ where: { id } });
  }

  private async ensureUnique(schoolId: string, name: string, code: string, excludedId?: string) {
    const duplicate = await this.prisma.subject.findFirst({
      where: { schoolId, ...(excludedId ? { id: { not: excludedId } } : {}), OR: [{ name: { equals: name, mode: 'insensitive' } }, { code: { equals: code, mode: 'insensitive' } }] },
    });
    if (duplicate) throw new ConflictException(duplicate.code.toLowerCase() === code.toLowerCase() ? 'Subject code already exists within this school.' : 'Subject name already exists within this school.');
  }

  private requiredValue(value: string | undefined, field: string) {
    if (!value?.trim()) throw new BadRequestException(`${field} is required.`);
    return value.trim();
  }

  private validateStatus(status?: string): asserts status is SubjectStatus | undefined {
    if (status !== undefined && !['ACTIVE', 'INACTIVE'].includes(status)) throw new BadRequestException('Subject status must be ACTIVE or INACTIVE.');
  }
  private parseStatus(status?: string) { this.validateStatus(status); return status as SubjectStatus | undefined; }
  private validateType(type?: string): asserts type is SubjectType | undefined {
    if (type !== undefined && !['CORE', 'ELECTIVE', 'OPTIONAL'].includes(type)) throw new BadRequestException('Subject type must be CORE, ELECTIVE, or OPTIONAL.');
  }
  private requireSchoolId(schoolId: string | null): asserts schoolId is string {
    if (!schoolId) throw new ForbiddenException('A school-admin account must be assigned to a school.');
  }
  private assertSchoolAccess(resourceSchoolId: string, actorSchoolId: string) {
    if (resourceSchoolId !== actorSchoolId) throw new ForbiddenException('You can only access subjects for your own school.');
  }
  private rethrowUnique(error: unknown): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw new ConflictException('Subject name or code already exists within this school.');
    throw error;
  }
}
