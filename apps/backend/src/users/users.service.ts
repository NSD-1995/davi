import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto, UpdateUserDto, AssignRoleDto } from './users.dto';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(schoolId: string | null) {
    this.requireSchool(schoolId);
    const users = await this.prisma.user.findMany({
      where: { schoolId },
      include: {
        school: true,
        roles: { include: { role: true } },
        student: true,
        teacher: true,
        parent: true,
      },
    });
    return users.map((user) => this.safe(user));
  }

  async findOne(id: string, schoolId: string | null) {
    this.requireSchool(schoolId);
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
    if (user.schoolId !== schoolId) throw new ForbiddenException('You can only access users from your own school.');

    return this.safe(user);
  }

  async create(schoolId: string | null, data: CreateUserDto) {
    this.requireSchool(schoolId);
    if (data.schoolId !== schoolId) throw new ForbiddenException('You can only create users for your own school.');
    const baseUserData = {
      email: data.email,
      firstName: data.firstName,
      lastName: data.lastName,
      passwordHash: data.passwordHash,
      phone: data.phone,
      avatarUrl: data.avatarUrl,
      status: data.status ?? 'ACTIVE',
    };

    const user = data.schoolId
      ? await this.prisma.user.create({
          data: {
            ...baseUserData,
            schoolId: data.schoolId,
          },
        })
      : await this.prisma.user.create({
          data: baseUserData,
        });
    return this.safe(user);
  }

  async update(id: string, schoolId: string | null, data: UpdateUserDto) {
    await this.findOne(id, schoolId);
    if (data.schoolId !== undefined && data.schoolId !== schoolId) throw new ForbiddenException('A user cannot be moved to another school.');

    const user = await this.prisma.user.update({
      where: { id },
      data: {
        ...data,
        ...(data.status ? { status: data.status } : {}),
      },
    });
    return this.safe(user);
  }

  async remove(id: string, schoolId: string | null) {
    await this.findOne(id, schoolId);

    const user = await this.prisma.user.delete({ where: { id } });
    return this.safe(user);
  }

  async findRoles(userId: string, schoolId: string | null) {
    await this.findOne(userId, schoolId);

    return this.prisma.userRole.findMany({
      where: { userId },
      include: { role: true },
      orderBy: { assignedAt: 'asc' },
    });
  }

  async assignRole(userId: string, schoolId: string | null, data: AssignRoleDto) {
    await this.findOne(userId, schoolId);

    let role = null;

    if (data.roleId) {
      role = await this.prisma.role.findFirst({ where: { id: data.roleId, schoolId: schoolId! } });
    } else if (data.roleName) {
      const code = data.roleName.toUpperCase().replace(/[^A-Z0-9]+/g, '_');
      role = await this.prisma.role.findFirst({ where: { schoolId: schoolId!, code } });
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

  async removeRole(userId: string, roleId: string, schoolId: string | null) {
    await this.findOne(userId, schoolId);

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

  private requireSchool(schoolId: string | null): asserts schoolId is string { if (!schoolId) throw new ForbiddenException('A school account is required.'); }
  private safe(user: any) { user.passwordHash = undefined; return user; }
}
