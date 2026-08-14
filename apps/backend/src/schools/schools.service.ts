import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import {
  AddUserProfileOptionDto,
  CreateSchoolDto,
  CreateSchoolProfileOptionDto,
  UpdateSchoolDto,
  UpdateSchoolProfileOptionDto,
} from './schools.dto';

@Injectable()
export class SchoolsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.school.findMany({
      include: {
        users: true,
      },
    });
  }

  async findOne(id: string) {
    const school = await this.prisma.school.findUnique({
      where: { id },
      include: {
        users: true,
      },
    });

    if (!school) {
      throw new NotFoundException(`School with id ${id} not found`);
    }

    return school;
  }

  async create(data: CreateSchoolDto) {
    if (!data.adminEmail) {
      throw new BadRequestException('Admin email is required when creating a school');
    }

    const existingAdmin = await this.prisma.user.findUnique({
      where: { email: data.adminEmail },
    });

    if (existingAdmin) {
      throw new BadRequestException(
        `A user with email ${data.adminEmail} already exists. Please use a unique school admin email.`,
      );
    }

    const normalizedName = data.name.trim();
    const existingSchool = await this.prisma.school.findFirst({
      where: { name: normalizedName },
    });

    if (existingSchool) {
      throw new BadRequestException(`School with name "${normalizedName}" already exists`);
    }

    const school = await this.prisma.school.create({
      data: {
        name: data.name,
        shortName: data.shortName,
        address: data.address,
        city: data.city,
        country: data.country,
        phone: data.phone,
        email: data.email,
        website: data.website,
      },
    });

    const tempPassword = this.generateTemporaryPassword();
    const passwordHash = await bcrypt.hash(tempPassword, 10);

    const adminUser = await this.prisma.user.create({
      data: {
        schoolId: school.id,
        email: data.adminEmail,
        passwordHash,
        firstName: data.adminFirstName ?? 'School',
        lastName: data.adminLastName ?? 'Admin',
        phone: data.phone,
        mustChangePassword: true,
      },
    });

    const schoolAdminRole = await this.prisma.role.upsert({
      where: { name: 'school-admin' },
      update: {},
      create: { name: 'school-admin' },
    });

    await this.prisma.userRole.upsert({
      where: {
        userId_roleId: {
          userId: adminUser.id,
          roleId: schoolAdminRole.id,
        },
      },
      update: {},
      create: {
        userId: adminUser.id,
        roleId: schoolAdminRole.id,
      },
    });

    return {
      message: 'School and school admin created successfully',
      school,
      admin: {
        id: adminUser.id,
        email: adminUser.email,
        schoolId: adminUser.schoolId,
        mustChangePassword: adminUser.mustChangePassword,
      },
      temporaryPassword: tempPassword,
    };
  }

  private generateTemporaryPassword() {
    return `DAVI-${Math.random().toString(36).slice(2, 10).toUpperCase()}`;
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

  async findSchoolStudents(schoolId: string) {
    await this.findOne(schoolId);

    return this.prisma.student.findMany({
      where: { schoolId },
      include: {
        user: true,
        school: true,
        studentParents: { include: { parent: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async findSchoolTeachers(schoolId: string) {
    await this.findOne(schoolId);

    return this.prisma.teacher.findMany({
      where: { schoolId },
      include: {
        user: true,
        school: true,
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async findSchoolParents(schoolId: string) {
    await this.findOne(schoolId);

    return this.prisma.parent.findMany({
      where: { schoolId },
      include: {
        user: true,
        school: true,
        studentParents: { include: { student: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async findProfileOptions(schoolId: string) {
    await this.findOne(schoolId);

    return this.prisma.schoolProfileOption.findMany({
      where: { schoolId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async createProfileOption(schoolId: string, data: CreateSchoolProfileOptionDto) {
    await this.findOne(schoolId);

    if (!data.key?.trim()) {
      throw new BadRequestException('Profile option key is required');
    }

    if (!data.label?.trim()) {
      throw new BadRequestException('Profile option label is required');
    }

    return this.prisma.schoolProfileOption.upsert({
      where: {
        schoolId_key: {
          schoolId,
          key: data.key.trim(),
        },
      },
      update: {
        label: data.label.trim(),
        type: data.type ?? 'text',
        description: data.description ?? null,
        isRequired: data.isRequired ?? false,
        isActive: data.isActive ?? true,
      },
      create: {
        schoolId,
        key: data.key.trim(),
        label: data.label.trim(),
        type: data.type ?? 'text',
        description: data.description ?? null,
        isRequired: data.isRequired ?? false,
        isActive: data.isActive ?? true,
      },
    });
  }

  async updateProfileOption(
    schoolId: string,
    optionId: string,
    data: UpdateSchoolProfileOptionDto,
  ) {
    await this.findOne(schoolId);

    const option = await this.prisma.schoolProfileOption.findFirst({
      where: { id: optionId, schoolId },
    });

    if (!option) {
      throw new NotFoundException(
        `Profile option with id ${optionId} not found for school ${schoolId}`,
      );
    }

    if (data.key !== undefined && !data.key.trim()) {
      throw new BadRequestException('Profile option key cannot be empty');
    }

    return this.prisma.schoolProfileOption.update({
      where: { id: optionId },
      data: {
        ...(data.key !== undefined ? { key: data.key.trim() } : {}),
        ...(data.label !== undefined ? { label: data.label.trim() } : {}),
        ...(data.type !== undefined ? { type: data.type } : {}),
        ...(data.description !== undefined ? { description: data.description } : {}),
        ...(data.isRequired !== undefined ? { isRequired: data.isRequired } : {}),
        ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
      },
    });
  }

  async removeProfileOption(schoolId: string, optionId: string) {
    await this.findOne(schoolId);

    const option = await this.prisma.schoolProfileOption.findFirst({
      where: { id: optionId, schoolId },
    });

    if (!option) {
      throw new NotFoundException(
        `Profile option with id ${optionId} not found for school ${schoolId}`,
      );
    }

    return this.prisma.schoolProfileOption.delete({ where: { id: optionId } });
  }

  async findUserProfileOptions(schoolId: string, userId: string) {
    await this.findOne(schoolId);

    const user = await this.prisma.user.findFirst({
      where: { id: userId, schoolId },
    });

    if (!user) {
      throw new NotFoundException(`User with id ${userId} not found in school ${schoolId}`);
    }

    return this.prisma.userSchoolProfileOption.findMany({
      where: { userId, schoolId },
      include: { option: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  async addUserProfileOption(schoolId: string, userId: string, data: AddUserProfileOptionDto) {
    await this.findOne(schoolId);

    const user = await this.prisma.user.findFirst({
      where: { id: userId, schoolId },
    });

    if (!user) {
      throw new NotFoundException(`User with id ${userId} not found in school ${schoolId}`);
    }

    let option = null;

    if (data.optionId) {
      option = await this.prisma.schoolProfileOption.findFirst({
        where: { id: data.optionId, schoolId },
      });
    } else if (data.key) {
      option = await this.prisma.schoolProfileOption.findFirst({
        where: { schoolId, key: data.key.trim() },
      });
    }

    if (!option) {
      throw new NotFoundException(
        'Profile option not found for this school. Please create the school profile option first.',
      );
    }

    return this.prisma.userSchoolProfileOption.upsert({
      where: {
        userId_optionId: {
          userId,
          optionId: option.id,
        },
      },
      update: {
        value: data.value ?? null,
      },
      create: {
        userId,
        schoolId,
        optionId: option.id,
        value: data.value ?? null,
      },
      include: { option: true },
    });
  }

  async removeUserProfileOption(schoolId: string, userId: string, optionId: string) {
    await this.findOne(schoolId);

    const user = await this.prisma.user.findFirst({
      where: { id: userId, schoolId },
    });

    if (!user) {
      throw new NotFoundException(`User with id ${userId} not found in school ${schoolId}`);
    }

    const option = await this.prisma.schoolProfileOption.findFirst({
      where: { id: optionId, schoolId },
    });

    if (!option) {
      throw new NotFoundException(
        `Profile option with id ${optionId} not found for school ${schoolId}`,
      );
    }

    const assignment = await this.prisma.userSchoolProfileOption.findUnique({
      where: {
        userId_optionId: {
          userId,
          optionId,
        },
      },
    });

    if (!assignment) {
      throw new NotFoundException(
        `User ${userId} does not have profile option ${optionId} assigned`,
      );
    }

    return this.prisma.userSchoolProfileOption.delete({
      where: {
        userId_optionId: {
          userId,
          optionId,
        },
      },
    });
  }
}
