import { slugValue } from '../school-experience/experience-rules';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { accountCreationPassword } from '../auth/development-password';
import { PrismaService } from '../prisma/prisma.service';
import { SchoolOnboardingService } from './school-onboarding.service';
import {
  AddUserProfileOptionDto,
  CreateSchoolDto,
  CreateSchoolProfileOptionDto,
  UpdateSchoolDto,
  UpdateSchoolProfileOptionDto,
} from './schools.dto';

@Injectable()
export class SchoolsService {
  constructor(private readonly prisma: PrismaService, private readonly onboarding: SchoolOnboardingService) {}

  async findCurrent(schoolId: string | null) {
    if (!schoolId) throw new ForbiddenException('A school account is required.');
    const school = await this.prisma.school.findUnique({ where: { id: schoolId } });
    if (!school) throw new NotFoundException(`School with id ${schoolId} not found`);
    return school;
  }

  onboardingState(schoolId: string | null) { return this.onboarding.state(schoolId); }
  completeOnboarding(schoolId: string | null, skipped = false) { return this.onboarding.complete(schoolId, skipped); }
  saveOnboardingProgress(schoolId: string | null, step: unknown) { return this.onboarding.saveProgress(schoolId, step); }
  resumeOnboarding(schoolId: string | null) { return this.onboarding.resume(schoolId); }
  acknowledgeOnboardingWelcome(schoolId: string | null) { return this.onboarding.acknowledgeWelcome(schoolId); }

  async updateCurrent(schoolId: string | null, data: UpdateSchoolDto) {
    if (!schoolId) throw new ForbiddenException('A school account is required.');
    const allowed = {
      ...(data.name !== undefined ? { name: data.name.trim() } : {}),
      ...(data.shortName !== undefined ? { shortName: data.shortName.trim() || null } : {}),
      ...(data.address !== undefined ? { address: data.address.trim() || null } : {}),
      ...(data.city !== undefined ? { city: data.city.trim() || null } : {}),
      ...(data.state !== undefined ? { state: data.state.trim() || null } : {}),
      ...(data.country !== undefined ? { country: data.country.trim() || null } : {}),
      ...(data.phone !== undefined ? { phone: data.phone.trim() || null } : {}),
      ...(data.landline !== undefined ? { landline: data.landline.trim() || null } : {}),
      ...(data.email !== undefined ? { email: data.email.trim().toLowerCase() || null } : {}),
      ...(data.website !== undefined ? { website: data.website.trim() || null } : {}),
    };
    if ('name' in allowed && !allowed.name) throw new BadRequestException('School name is required.');
    await this.findOne(schoolId);
    return this.prisma.school.update({ where: { id: schoolId }, data: allowed });
  }

  findAll() {
    return this.prisma.school.findMany({
      include: {
        users: true,
      },
    });
  }

  async shortNameAvailability(value: string) {
    const requested = String(value || '').trim();
    const slug = slugValue(this.slugify(requested));
    if (!slug) return { available: false, slug: '', suggestion: null, message: 'Use at least one letter or number.' };
    const taken = async (candidate: string) => Boolean(await this.prisma.school.findUnique({ where: { slug: candidate } }) || await this.prisma.schoolSlugAlias.findUnique({ where: { slug: candidate } }));
    if (!await taken(slug)) return { available: true, slug, suggestion: null, message: `/${slug} is available.` };
    let suffix = 2; let suggestion = `${slug}-${suffix}`;
    while (await taken(suggestion)) { suffix += 1; suggestion = `${slug}-${suffix}`; }
    return { available: false, slug, suggestion, message: `/${slug} is already assigned.` };
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

    if (!data.shortName?.trim()) {
      throw new BadRequestException('School short name is required for the school URL');
    }
    const schoolPhone = String(data.phone || '').trim().replace(/[\s()-]/g, '');
    const schoolLandline = String(data.landline || '').trim().replace(/[\s()-]/g, '');
    const validMobile = !schoolPhone || /^\+?[1-9]\d{9,14}$/.test(schoolPhone);
    const validLandline = !schoolLandline || /^\+?\d{6,15}$/.test(schoolLandline);
    if ((!schoolPhone && !schoolLandline) || !validMobile || !validLandline) {
      throw new BadRequestException('Enter a valid school mobile number or landline number.');
    }
    const programs=[...new Set((data.programs||[]).map(code=>String(code).trim().toUpperCase()))];
    const supported=new Set(['MONTESSORI','PRE_PRIMARY','PRIMARY','MIDDLE_SCHOOL','SECONDARY','HIGHER_SECONDARY']);
    if(!programs.length||programs.some(code=>!supported.has(code)))throw new BadRequestException('Select at least one supported school program.');

    const adminEmail = data.adminEmail.trim().toLowerCase();
    const existingAdmin = await this.prisma.user.findFirst({
      where: { email: adminEmail },
    });

    if (existingAdmin) {
      throw new BadRequestException(
        `A user with email ${data.adminEmail} already exists. Please use a unique school admin email.`,
      );
    }

    const normalizedName = data.name.trim();
    if(normalizedName.length<2)throw new BadRequestException('School name must contain at least two characters.');

    const slug = await this.createSchoolSlug(data.shortName);
    const tempPassword = this.generateTemporaryPassword();
    const passwordHash = await bcrypt.hash(tempPassword, 10);
    const {school,adminUser}=await this.prisma.$transaction(async tx=>{
      const school=await tx.school.create({data:{name:normalizedName,shortName:data.shortName.trim(),slug,address:data.address,city:data.city,state:data.state,country:data.country||'India',phone:schoolPhone||null,...(schoolLandline?{landline:schoolLandline}:{}),email:data.email,website:data.website,programEntitlements:{create:programs.map(code=>({code:code as any}))},onboarding:{create:{}}} as any});
      const adminUser=await tx.user.create({data:{schoolId:school.id,email:adminEmail,username:adminEmail,passwordHash,firstName:data.adminFirstName?.trim()||'School',lastName:data.adminLastName?.trim()||'Admin',phone:schoolPhone||null,mustChangePassword:true}});
      const schoolAdminRole=await tx.role.create({data:{schoolId:school.id,name:'School Admin',code:'SCHOOL_ADMIN',isSystem:true}});
      const permissions=await tx.permission.findMany({select:{id:true}});
      if(permissions.length)await tx.rolePermission.createMany({data:permissions.map(permission=>({roleId:schoolAdminRole.id,permissionId:permission.id})),skipDuplicates:true});
      await tx.userRole.create({data:{userId:adminUser.id,roleId:schoolAdminRole.id,schoolId:school.id}});
      return {school,adminUser};
    });

    const loginPath = `/school/${school.slug}/login`;
    const frontendUrl = (process.env.FRONTEND_URL ?? 'http://localhost:3000').replace(/\/$/, '');

    return {
      message: 'School and school admin created successfully. Academic structure will be completed during first login.',
      school,
      admin: {
        id: adminUser.id,
        email: adminUser.email,
        username: adminUser.username,
        schoolId: adminUser.schoolId,
        mustChangePassword: adminUser.mustChangePassword,
      },
      temporaryPassword: tempPassword,
      credentials: { username: adminUser.username, temporaryPassword: tempPassword },
      loginPath,
      loginUrl: `${frontendUrl}${loginPath}`,
    };
  }

  private async createSchoolSlug(shortName: string) {
    const slug = slugValue(this.slugify(shortName));
    if (!slug) throw new BadRequestException('School short name must contain letters or numbers');

    const alias = await this.prisma.schoolSlugAlias.findUnique({where:{slug}});
    if(alias)throw new ConflictException('School URL is already in use.');
    const existingSchool = await this.prisma.school.findUnique({ where: { slug } });
    if (existingSchool) throw new BadRequestException(`School short name "${shortName}" is already in use`);

    return slug;
  }

  private slugify(value: string) {
    return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  }

  private generateTemporaryPassword() {
    return accountCreationPassword();
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
      where: { enrollments: { some: { schoolId } } },
      include: {
        user: true,
        enrollments: { where: { schoolId }, include: { academicYear: true, schoolClass: true, section: true } },
        studentParents: { where: { status: 'ACTIVE' }, include: { parent: { include: { user: true } } } },
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

    return this.prisma.parentSchoolMembership.findMany({
      where: { schoolId },
      include: {
        school: true,
        parent: { include: { user: true, studentParents: { where: { student: { enrollments: { some: { schoolId } } } }, include: { student: true } } } },
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
