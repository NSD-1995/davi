import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateStudentDto, UpdateStudentDto } from './students.dto';

@Injectable()
export class StudentsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.student.findMany({
      include: {
        user: true,
        school: true,
        studentParents: { include: { parent: true } },
      },
    });
  }

  async findOne(id: string) {
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

    return student;
  }

  create(data: CreateStudentDto) {
    return this.prisma.student.create({
      data: {
        ...data,
        birthDate: data.birthDate ? new Date(data.birthDate) : null,
        status: data.status ?? 'ACTIVE',
      },
    });
  }

  async update(id: string, data: UpdateStudentDto) {
    await this.findOne(id);

    return this.prisma.student.update({
      where: { id },
      data: {
        ...data,
        ...(data.birthDate ? { birthDate: new Date(data.birthDate) } : {}),
        ...(data.status ? { status: data.status } : {}),
      },
    });
  }

  async remove(id: string) {
    await this.findOne(id);

    return this.prisma.student.delete({ where: { id } });
  }
}
