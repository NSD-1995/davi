import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto, UpdateUserDto } from './users.dto';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.user.findMany({
      include: {
        school: true,
        roles: { include: { role: true } },
        student: true,
        teacher: true,
        parent: true,
      },
    });
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        school: true,
        roles: { include: { role: true } },
        student: true,
        teacher: true,
        parent: true,
      },
    });

    if (!user) {
      throw new NotFoundException(`User with id ${id} not found`);
    }

    return user;
  }

  create(data: CreateUserDto) {
    const baseUserData = {
      email: data.email,
      firstName: data.firstName,
      lastName: data.lastName,
      passwordHash: data.passwordHash,
      phone: data.phone,
      avatarUrl: data.avatarUrl,
      status: data.status ?? 'ACTIVE',
    };

    return data.schoolId
      ? this.prisma.user.create({
          data: {
            ...baseUserData,
            schoolId: data.schoolId,
          },
        })
      : this.prisma.user.create({
          data: baseUserData,
        });
  }

  async update(id: string, data: UpdateUserDto) {
    await this.findOne(id);

    return this.prisma.user.update({
      where: { id },
      data: {
        ...data,
        ...(data.status ? { status: data.status } : {}),
      },
    });
  }

  async remove(id: string) {
    await this.findOne(id);

    return this.prisma.user.delete({ where: { id } });
  }
}
