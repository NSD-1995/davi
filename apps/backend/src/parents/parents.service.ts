import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateParentDto, UpdateParentDto } from './parents.dto';

@Injectable()
export class ParentsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.parent.findMany({
      include: {
        user: true,
        school: true,
        studentParents: { include: { student: true } },
      },
    });
  }

  async findOne(id: string) {
    const parent = await this.prisma.parent.findUnique({
      where: { id },
      include: {
        user: true,
        school: true,
        studentParents: { include: { student: true } },
      },
    });

    if (!parent) {
      throw new NotFoundException(`Parent with id ${id} not found`);
    }

    return parent;
  }

  create(data: CreateParentDto) {
    return this.prisma.parent.create({
      data: {
        ...data,
        status: data.status ?? 'ACTIVE',
      },
    });
  }

  async update(id: string, data: UpdateParentDto) {
    await this.findOne(id);

    return this.prisma.parent.update({
      where: { id },
      data: {
        ...data,
        ...(data.status ? { status: data.status } : {}),
      },
    });
  }

  async remove(id: string) {
    await this.findOne(id);

    return this.prisma.parent.delete({ where: { id } });
  }
}
