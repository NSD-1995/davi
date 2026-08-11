import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
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
}
