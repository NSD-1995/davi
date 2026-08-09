import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTeacherDto, UpdateTeacherDto } from './teachers.dto';

@Injectable()
export class TeachersService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.teacher.findMany({
      include: {
        user: true,
        school: true,
      },
    });
  }

  async findOne(id: string) {
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

    return teacher;
  }

  create(data: CreateTeacherDto) {
    return this.prisma.teacher.create({
      data: {
        ...data,
        hireDate: data.hireDate ? new Date(data.hireDate) : null,
        status: data.status ?? 'ACTIVE',
      },
    });
  }

  async update(id: string, data: UpdateTeacherDto) {
    await this.findOne(id);

    return this.prisma.teacher.update({
      where: { id },
      data: {
        ...data,
        ...(data.hireDate ? { hireDate: new Date(data.hireDate) } : {}),
        ...(data.status ? { status: data.status } : {}),
      },
    });
  }

  async remove(id: string) {
    await this.findOne(id);

    return this.prisma.teacher.delete({ where: { id } });
  }
}
