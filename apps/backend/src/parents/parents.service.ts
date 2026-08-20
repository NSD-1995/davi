import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { CreateParentDto, LinkParentStudentDto, OnboardParentDto, UpdateParentDto } from './parents.dto';

@Injectable()
export class ParentsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(schoolId: string | null) {
    this.requireSchool(schoolId);
    const parents = await this.prisma.parent.findMany({
      where: { schoolId },
      include: {
        user: true,
        school: true,
        studentParents: { include: { student: true } },
      },
    });
    return parents.map((parent) => this.safe(parent));
  }

  async findOne(id: string, schoolId: string | null) {
    this.requireSchool(schoolId);
    const parent = await this.prisma.parent.findUnique({
      where: { id },
      include: {
        user: true,
        school: true,
        studentParents: { include: { student: true } },
      },
    });

    if (!parent) {
      throw new NotFoundException(`Parent with id ${id} not found`);
    }
    if (parent.schoolId !== schoolId) throw new ForbiddenException('You can only access parents from your own school.');

    return this.safe(parent);
  }

  async create(schoolId: string | null, data: CreateParentDto) {
    this.requireSchool(schoolId);
    if (data.schoolId !== schoolId) throw new ForbiddenException('You can only create parents for your own school.');
    const user = await this.prisma.user.findFirst({ where: { id: data.userId, schoolId } });
    if (!user) throw new NotFoundException('User not found for your school.');
    return this.prisma.parent.create({
      data: {
        ...data,
        status: data.status ?? 'ACTIVE',
      },
    });
  }

  async update(id: string, schoolId: string | null, data: UpdateParentDto) {
    await this.findOne(id, schoolId);
    if (data.schoolId !== undefined && data.schoolId !== schoolId) throw new ForbiddenException('A parent cannot be moved to another school.');

    return this.prisma.parent.update({
      where: { id },
      data: {
        ...data,
        ...(data.status ? { status: data.status } : {}),
      },
    });
  }

  async remove(id: string, schoolId: string | null) {
    await this.findOne(id, schoolId);

    return this.prisma.parent.delete({ where: { id } });
  }

  async onboard(schoolId: string | null, data: OnboardParentDto) {
    this.requireSchool(schoolId);
    const mobile = this.mobile(data.mobile); const firstName = this.required(data.firstName, 'firstName'); const parentCode = this.required(data.parentCode, 'parentCode');
    if (await this.prisma.user.findFirst({ where: { OR: [{ username: mobile }, ...(data.email ? [{ email: data.email.trim().toLowerCase() }] : [])] } })) throw new ConflictException('A login with this mobile number or email already exists.');
    if (await this.prisma.parent.findFirst({ where: { schoolId, parentCode } })) throw new ConflictException('Parent code already exists within this school.');
    let role = await this.prisma.role.findFirst({ where: { schoolId, code: 'PARENT' } });
    if (!role) role = await this.prisma.role.create({ data: { schoolId, name: 'Parent', code: 'PARENT', description: 'Parent portal access' } });
    const temporaryPassword = `DAVI-${randomBytes(6).toString('base64url')}`; const passwordHash = await bcrypt.hash(temporaryPassword, 10); const email = data.email?.trim().toLowerCase() || `${mobile}@login.davi.local`;
    const parent = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({ data: { schoolId, username: mobile, email, passwordHash, firstName, lastName: data.lastName?.trim() || '', phone: mobile, mustChangePassword: true } });
      const created = await tx.parent.create({ data: { schoolId, userId: user.id, parentCode, occupation: data.occupation ?? null } });
      await tx.userRole.create({ data: { userId: user.id, roleId: role.id, schoolId } });
      return tx.parent.findUniqueOrThrow({ where: { id: created.id }, include: { user: true } });
    });
    return { message: 'Parent created successfully', parent: this.safe(parent), credentials: { username: mobile, temporaryPassword, mustChangePassword: true } };
  }

  async linkStudent(parentId: string, schoolId: string | null, data: LinkParentStudentDto) {
    this.requireSchool(schoolId); await this.findOne(parentId, schoolId);
    const student = await this.prisma.student.findFirst({ where: { id: data.studentId, schoolId } });
    if (!student) throw new NotFoundException('Student not found for your school.');
    if (data.isPrimary) await this.prisma.studentParent.updateMany({ where: { studentId: data.studentId }, data: { isPrimary: false } });
    return this.prisma.studentParent.upsert({ where: { studentId_parentId: { studentId: data.studentId, parentId } }, update: { relationshipType: data.relationshipType ?? 'guardian', isPrimary: data.isPrimary ?? false }, create: { studentId: data.studentId, parentId, relationshipType: data.relationshipType ?? 'guardian', isPrimary: data.isPrimary ?? false }, include: { student: true, parent: true } });
  }

  async unlinkStudent(parentId: string, studentId: string, schoolId: string | null) {
    this.requireSchool(schoolId); await this.findOne(parentId, schoolId);
    const student = await this.prisma.student.findFirst({ where: { id: studentId, schoolId } }); if (!student) throw new NotFoundException('Student not found for your school.');
    const link = await this.prisma.studentParent.findUnique({ where: { studentId_parentId: { studentId, parentId } } }); if (!link) throw new NotFoundException('Parent is not linked to this student.');
    return this.prisma.studentParent.delete({ where: { studentId_parentId: { studentId, parentId } } });
  }

  async findMyStudents(userId: string, schoolId: string | null) {
    this.requireSchool(schoolId);
    const parent = await this.prisma.parent.findFirst({ where: { userId, schoolId } });
    if (!parent) throw new ForbiddenException('The logged-in user does not have a Parent profile.');
    return this.prisma.studentParent.findMany({ where: { parentId: parent.id }, include: { student: { include: { user: { select: { id: true, firstName: true, lastName: true } }, enrollments: { include: { academicYear: true, schoolClass: true, section: true }, orderBy: { createdAt: 'desc' } } } } } });
  }

  private required(value: string | undefined, field: string) { if (!value?.trim()) throw new BadRequestException(`${field} is required.`); return value.trim(); }
  private mobile(value: string | undefined) { const digits = value?.replace(/\D/g, '') ?? ''; const normalized = digits.startsWith('91') && digits.length === 12 ? digits.slice(2) : digits; if (!/^[6-9]\d{9}$/.test(normalized)) throw new BadRequestException('mobile must be a valid 10-digit Indian mobile number.'); return normalized; }

  private requireSchool(schoolId: string | null): asserts schoolId is string { if (!schoolId) throw new ForbiddenException('A school account is required.'); }
  private safe(parent: any) { if (parent.user) parent.user.passwordHash = undefined; return parent; }
}
