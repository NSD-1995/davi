import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSubjectDto, UpdateSubjectDto } from './subjects.dto';

@Injectable()
export class SubjectsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.subject.findMany({
      include: { school: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  async findOne(id: string) {
    const subject = await this.prisma.subject.findUnique({
      where: { id },
      include: { school: true },
    });

    if (!subject) {
      throw new NotFoundException(`Subject with id ${id} not found`);
    }

    return subject;
  }

  findBySchool(schoolId: string) {
    return this.prisma.subject.findMany({
      where: { schoolId },
      include: { school: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  async create(data: CreateSubjectDto) {
    const school = await this.prisma.school.findUnique({ where: { id: data.schoolId } });
    if (!school) {
      throw new NotFoundException(`School with id ${data.schoolId} not found`);
    }

    return this.prisma.subject.create({
      data: {
        schoolId: data.schoolId,
        name: data.name,
        code: data.code ?? null,
        description: data.description ?? null,
        type: data.type ?? 'core',
        status: data.status ?? 'ACTIVE',
      },
      include: { school: true },
    });
  }

  async update(id: string, data: UpdateSubjectDto) {
    await this.findOne(id);

    return this.prisma.subject.update({
      where: { id },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.code !== undefined ? { code: data.code } : {}),
        ...(data.description !== undefined ? { description: data.description } : {}),
        ...(data.type !== undefined ? { type: data.type } : {}),
        ...(data.status !== undefined ? { status: data.status } : {}),
      },
      include: { school: true },
    });
  }

  async remove(id: string) {
    await this.findOne(id);

    return this.prisma.subject.delete({ where: { id } });
  }
}
