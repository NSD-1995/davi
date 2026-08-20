import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSchoolSettingDto, UpdateSchoolSettingDto } from './school-settings.dto';

@Injectable()
export class SchoolSettingsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(schoolId: string | null) {
    this.requireSchool(schoolId);
    return this.prisma.schoolSetting.findMany({
      where: { schoolId },
      include: { school: true },
    });
  }

  async findOne(id: string, schoolId: string | null) {
    this.requireSchool(schoolId);
    const setting = await this.prisma.schoolSetting.findUnique({
      where: { id },
      include: { school: true },
    });

    if (!setting) {
      throw new NotFoundException(`School setting with id ${id} not found`);
    }
    if (setting.schoolId !== schoolId) throw new ForbiddenException('You can only access settings for your own school.');

    return setting;
  }

  async findBySchoolId(schoolId: string, actorSchoolId: string | null) {
    this.requireSchool(actorSchoolId);
    if (schoolId !== actorSchoolId) throw new ForbiddenException('You can only access settings for your own school.');
    const setting = await this.prisma.schoolSetting.findUnique({
      where: { schoolId },
      include: { school: true },
    });

    if (!setting) {
      throw new NotFoundException(`Settings for school ${schoolId} not found`);
    }

    return setting;
  }

  async create(actorSchoolId: string | null, data: CreateSchoolSettingDto) {
    this.requireSchool(actorSchoolId);
    const schoolId = data.schoolId;

    if (!schoolId) {
      throw new Error('schoolId is required');
    }
    if (schoolId !== actorSchoolId) throw new ForbiddenException('You can only create settings for your own school.');

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

  async update(id: string, schoolId: string | null, data: UpdateSchoolSettingDto) {
    await this.findOne(id, schoolId);

    return this.prisma.schoolSetting.update({
      where: { id },
      data,
    });
  }

  async remove(id: string, schoolId: string | null) {
    await this.findOne(id, schoolId);

    return this.prisma.schoolSetting.delete({ where: { id } });
  }
  private requireSchool(schoolId: string | null): asserts schoolId is string { if (!schoolId) throw new ForbiddenException('A school account is required.'); }
}
