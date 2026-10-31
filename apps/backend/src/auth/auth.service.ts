import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { createHash } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { ChangePasswordDto, CompletePlatformPasswordResetDto, LoginDto, RegisterDto } from './auth.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    const existingUser = await this.prisma.user.findFirst({
      where: { schoolId: dto.schoolId ?? null, email: dto.email },
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

  async completePlatformPasswordReset(dto: CompletePlatformPasswordResetDto) {
    if (!dto.token?.trim() || !dto.newPassword || dto.newPassword.length < 12) throw new BadRequestException('Use the reset link and a password of at least 12 characters.');
    const db: any = this.prisma; const tokenHash = createHash('sha256').update(dto.token.trim()).digest('hex');
    const reset = await db.platformPasswordReset.findUnique({ where: { tokenHash }, include: { user: { include: { roles: { include: { role: true } } } } } });
    if (!reset || reset.usedAt || reset.expiresAt <= new Date() || reset.user.schoolId || !reset.user.roles.some((entry:any) => entry.role.code === 'SUPER_ADMIN')) throw new BadRequestException('This password reset link is invalid or has expired.');
    const passwordHash = await bcrypt.hash(dto.newPassword, 10);
    await db.$transaction(async (tx:any) => { const consumed = await tx.platformPasswordReset.updateMany({ where: { id: reset.id, usedAt: null }, data: { usedAt: new Date() } }); if (consumed.count !== 1) throw new BadRequestException('This password reset link has already been used.'); await tx.user.update({ where: { id: reset.userId }, data: { passwordHash, mustChangePassword: false } }); });
    return { message: 'Password reset successfully. You can now sign in to DAVI.' };
  }

  async login(dto: LoginDto) {
    if (dto.platform && (dto.schoolId || dto.schoolSlug)) throw new BadRequestException('DAVI Admin sign-in cannot be combined with a school login.');
    if(dto.schoolSlug){const key=dto.schoolSlug.trim().toLowerCase();const alias=await this.prisma.schoolSlugAlias.findUnique({where:{slug:key}});if(alias){const school=await this.prisma.school.findUnique({where:{id:alias.schoolId},select:{slug:true}});if(school)dto={...dto,schoolSlug:school.slug};}}

    const identifier = dto.username?.trim() || dto.email?.trim().toLowerCase();
    if (!identifier) throw new BadRequestException('Email or username is required.');
    const users = await this.prisma.user.findMany({
      where: { status: 'ACTIVE', ...(dto.platform ? { schoolId: null, roles: { some: { role: { code: 'SUPER_ADMIN' } } } } : {}), ...(dto.schoolId ? { schoolId: dto.schoolId } : {}), ...(dto.schoolSlug ? { school: { slug: dto.schoolSlug.trim().toLowerCase() } } : {}), OR: [{ email: identifier }, { username: identifier }] },
      take: 2,
      include: {
        school: true,
        roles: { include: { role: true } },
      },
    });

    if (users.length > 1) throw new BadRequestException('Multiple active accounts use this identifier. Sign in through your school login page or provide schoolId or schoolSlug.');
    const user = users[0];
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
