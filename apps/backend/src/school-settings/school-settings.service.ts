import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSchoolSettingDto, UpdateSchoolSettingDto } from './school-settings.dto';

@Injectable()
export class SchoolSettingsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.schoolSetting.findMany({
      include: { school: true },
    });
  }

  async findOne(id: string) {
    const setting = await this.prisma.schoolSetting.findUnique({
      where: { id },
      include: { school: true },
    });

    if (!setting) {
      throw new NotFoundException(`School setting with id ${id} not found`);
    }

    return setting;
  }

  async findBySchoolId(schoolId: string) {
    const setting = await this.prisma.schoolSetting.findUnique({
      where: { schoolId },
      include: { school: true },
    });

    if (!setting) {
      throw new NotFoundException(`Settings for school ${schoolId} not found`);
    }

    return setting;
  }

  async create(data: CreateSchoolSettingDto) {
    const schoolId = data.schoolId;

    if (!schoolId) {
      throw new Error('schoolId is required');
    }

    const school = await this.prisma.school.findUnique({ where: { id: schoolId } });
    if (!school) {
      throw new NotFoundException(`School with id ${schoolId} not found`);
    }

    return this.prisma.schoolSetting.upsert({
      where: { schoolId },
      update: {
        schoolName: data.schoolName ?? school.name,
        timezone: data.timezone ?? 'Africa/Nairobi',
        language: data.language ?? 'en',
        gradingSystem: data.gradingSystem ?? 'percentage',
        attendancePolicy: data.attendancePolicy ?? null,
        examPolicy: data.examPolicy ?? null,
        notificationEmail: data.notificationEmail ?? null,
        logoUrl: data.logoUrl ?? null,
      },
      create: {
        schoolId,
        schoolName: data.schoolName ?? school.name,
        timezone: data.timezone ?? 'Africa/Nairobi',
        language: data.language ?? 'en',
        gradingSystem: data.gradingSystem ?? 'percentage',
        attendancePolicy: data.attendancePolicy ?? null,
        examPolicy: data.examPolicy ?? null,
        notificationEmail: data.notificationEmail ?? null,
        logoUrl: data.logoUrl ?? null,
      },
    });
  }

  async update(id: string, data: UpdateSchoolSettingDto) {
    await this.findOne(id);

    return this.prisma.schoolSetting.update({
      where: { id },
      data,
    });
  }

  async remove(id: string) {
    await this.findOne(id);

    return this.prisma.schoolSetting.delete({ where: { id } });
  }
}
