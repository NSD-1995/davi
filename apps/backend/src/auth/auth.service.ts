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
    const roles = requestedRoles.map((roleName) => roleName.toLowerCase());

    if (roles.includes('super-admin') && dto.schoolId) {
      throw new BadRequestException(
        'DAVI Super Admin accounts are platform-level and cannot be assigned to a school.',
      );
    }

    const baseUserData = {
      email: dto.email,
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

    for (const roleName of roles) {
      const role = await this.prisma.role.upsert({
        where: { name: roleName },
        update: {},
        create: { name: roleName },
      });

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
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      include: {
        school: true,
        roles: { include: { role: true } },
      },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const isValidPassword = await bcrypt.compare(dto.password, user.passwordHash);

    if (!isValidPassword) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const token = this.jwtService.sign({ sub: user.id, email: user.email });

    return {
      message: 'Login successful',
      token,
      user: {
        ...user,
        passwordHash: undefined,
      },
    };
  }
}
