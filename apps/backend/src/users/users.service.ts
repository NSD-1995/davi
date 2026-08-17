import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto, UpdateUserDto, AssignRoleDto } from './users.dto';

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

  async findRoles(userId: string) {
    await this.findOne(userId);

    return this.prisma.userRole.findMany({
      where: { userId },
      include: { role: true },
      orderBy: { assignedAt: 'asc' },
    });
  }

  async assignRole(userId: string, data: AssignRoleDto) {
    await this.findOne(userId);

    let role = null;

    if (data.roleId) {
      role = await this.prisma.role.findUnique({ where: { id: data.roleId } });
    } else if (data.roleName) {
      const user = await this.prisma.user.findUnique({ where: { id: userId } });
      const code = data.roleName.toUpperCase().replace(/[^A-Z0-9]+/g, '_');
      role = await this.prisma.role.findFirst({ where: { schoolId: user?.schoolId ?? null, code } });
    }

    if (!role) {
      throw new NotFoundException('Role not found');
    }

    return this.prisma.userRole.upsert({
      where: {
        userId_roleId: {
          userId,
          roleId: role.id,
        },
      },
      update: {},
      create: {
        userId,
        roleId: role.id,
        schoolId: role.schoolId,
      },
      include: { role: true },
    });
  }

  async removeRole(userId: string, roleId: string) {
    await this.findOne(userId);

    const assignment = await this.prisma.userRole.findUnique({
      where: { userId_roleId: { userId, roleId } },
    });

    if (!assignment) {
      throw new NotFoundException(`User ${userId} does not have role ${roleId}`);
    }

    return this.prisma.userRole.delete({
      where: { userId_roleId: { userId, roleId } },
    });
  }
}
