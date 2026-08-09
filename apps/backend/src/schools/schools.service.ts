import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSchoolDto, UpdateSchoolDto } from './schools.dto';

@Injectable()
export class SchoolsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.school.findMany({
      include: {
        users: true,
        students: true,
        teachers: true,
        parents: true,
      },
    });
  }

  async findOne(id: string) {
    const school = await this.prisma.school.findUnique({
      where: { id },
      include: {
        users: true,
        students: true,
        teachers: true,
        parents: true,
      },
    });

    if (!school) {
      throw new NotFoundException(`School with id ${id} not found`);
    }

    return school;
  }

  create(data: CreateSchoolDto) {
    return this.prisma.school.create({ data });
  }

  async update(id: string, data: UpdateSchoolDto) {
    await this.findOne(id);

    return this.prisma.school.update({
      where: { id },
      data,
    });
  }

  async remove(id: string) {
    await this.findOne(id);

    return this.prisma.school.delete({ where: { id } });
  }
}
