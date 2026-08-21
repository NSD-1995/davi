import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { ChangePasswordDto, LoginDto, RegisterDto } from './auth.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (existingUser) {
      throw new BadRequestException('User with this email already exists');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);

    const requestedRoles = dto.roles?.length ? dto.roles : ['teacher'];
    const roles = requestedRoles.map((roleName) => roleName.toUpperCase().replace(/-/g, '_'));

    if (roles.includes('SUPER_ADMIN') && dto.schoolId) {
      throw new BadRequestException(
        'DAVI Super Admin accounts are platform-level and cannot be assigned to a school.',
      );
    }

    const baseUserData = {
      email: dto.email,
      username: dto.phone ?? null,
      passwordHash,
      firstName: dto.firstName,
      lastName: dto.lastName,
      phone: dto.phone,
      avatarUrl: dto.avatarUrl,
      mustChangePassword: dto.mustChangePassword ?? true,
    };

    const user = dto.schoolId
      ? await this.prisma.user.create({
          data: {
            ...baseUserData,
            schoolId: dto.schoolId,
          },
          include: {
            school: true,
            roles: { include: { role: true } },
          },
        })
      : await this.prisma.user.create({
          data: baseUserData,
          include: {
            school: true,
            roles: { include: { role: true } },
          },
        });

    for (const roleCode of roles) {
      let role = await this.prisma.role.findFirst({ where: { schoolId: dto.schoolId ?? null, code: roleCode } });
      if (!role) role = await this.prisma.role.create({ data: { schoolId: dto.schoolId ?? null, name: roleCode.toLowerCase().replace(/_/g, '-'), code: roleCode, isSystem: ['SUPER_ADMIN', 'SCHOOL_ADMIN'].includes(roleCode) } });

      await this.prisma.userRole.upsert({
        where: {
          userId_roleId: {
            userId: user.id,
            roleId: role.id,
          },
        },
        update: {},
        create: {
          userId: user.id,
          roleId: role.id,
          schoolId: dto.schoolId ?? null,
        },
      });
    }

    const token = this.jwtService.sign({ sub: user.id, email: user.email });

    return {
      message: 'User registered successfully',
      token,
      user: {
        ...user,
        passwordHash: undefined,
      },
    };
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    if (user.status !== 'ACTIVE') throw new UnauthorizedException('User account is not active');

    const isCurrentPasswordValid = await bcrypt.compare(dto.currentPassword, user.passwordHash);

    if (!isCurrentPasswordValid) {
      throw new BadRequestException('Current password is incorrect');
    }

    const newPasswordHash = await bcrypt.hash(dto.newPassword, 10);

    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash: newPasswordHash,
        mustChangePassword: false,
      },
    });

    return {
      message: 'Password changed successfully',
      user: {
        ...updatedUser,
        passwordHash: undefined,
      },
    };
  }

  async login(dto: LoginDto) {
    const identifier = dto.username?.trim() || dto.email?.trim().toLowerCase();
    if (!identifier) throw new BadRequestException('Email or username is required.');
    const user = await this.prisma.user.findFirst({
      where: { OR: [{ email: identifier }, { username: identifier }] },
      include: {
        school: true,
        roles: { include: { role: true } },
      },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid username/email or password');
    }

    if (user.status !== 'ACTIVE') throw new UnauthorizedException('User account is not active');

    const isValidPassword = await bcrypt.compare(dto.password, user.passwordHash);

    if (!isValidPassword) {
      throw new UnauthorizedException('Invalid username/email or password');
    }

    const token = this.jwtService.sign({ sub: user.id, email: user.email });

    return {
      message: 'Login successful',
      token,
      requiresPasswordChange: user.mustChangePassword,
      user: {
        ...user,
        passwordHash: undefined,
      },
    };
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, include: { school: true, roles: { include: { role: { include: { rolePermissions: { include: { permission: true } } } } } } } });
    if (!user) throw new UnauthorizedException('User not found');
    const roleCodes = user.roles.map((item) => item.role.code);
    const permissions = roleCodes.some((code) => code === 'SUPER_ADMIN' || code === 'SCHOOL_ADMIN')
      ? (await this.prisma.permission.findMany({ select: { code: true } })).map((item) => item.code)
      : [...new Set(user.roles.flatMap((item) => item.role.rolePermissions.map((mapping) => mapping.permission.code)))];
    return { user: { id: user.id, firstName: user.firstName, lastName: user.lastName, schoolId: user.schoolId, username: user.username, mustChangePassword: user.mustChangePassword, school: user.school }, roles: user.roles.map((item) => ({ id: item.role.id, name: item.role.name, code: item.role.code })), permissions };
  }
}
