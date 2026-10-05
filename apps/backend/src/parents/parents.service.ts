import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import { accountCreationPassword } from '../auth/development-password';
import { PrismaService } from '../prisma/prisma.service';
import { CreateParentDto, LinkParentStudentDto, OnboardParentDto, UpdateParentDto } from './parents.dto';

const parentInclude = { user: true, memberships: { include: { school: true } }, studentParents: { include: { student: { include: { user: { select: { firstName: true, lastName: true } }, enrollments: { include: { school: true, academicYear: true, schoolClass: true, section: true }, orderBy: { createdAt: 'desc' as const } } } } } } };

@Injectable()
export class ParentsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(schoolId: string | null) {
    this.requireSchool(schoolId);
    const memberships = await this.prisma.parentSchoolMembership.findMany({ where: { schoolId }, include: { parent: { include: parentInclude } }, orderBy: { createdAt: 'asc' } });
    return memberships.map((membership) => this.schoolView(membership.parent, membership, schoolId));
  }

  async findOne(id: string, schoolId: string | null) {
    this.requireSchool(schoolId);
    const membership = await this.prisma.parentSchoolMembership.findUnique({ where: { parentId_schoolId: { parentId: id, schoolId } }, include: { parent: { include: parentInclude } } });
    if (!membership) throw new ForbiddenException('You can only access parents connected to your own school.');
    return this.schoolView(membership.parent, membership, schoolId);
  }

  async create(schoolId: string | null, data: CreateParentDto) {
    this.requireSchool(schoolId);
    if (data.schoolId !== schoolId) throw new ForbiddenException('You can only create parents for your own school.');
    const user = await this.prisma.user.findUnique({ where: { id: data.userId }, include: { parent: true } });
    if (!user) throw new NotFoundException('User not found.');
    const parent = user.parent ?? await this.prisma.parent.create({ data: { userId: user.id } });
    return this.prisma.parentSchoolMembership.create({ data: { parentId: parent.id, schoolId, parentCode: this.required(data.parentCode, 'parentCode'), occupation: data.occupation, status: data.status ?? 'ACTIVE', verificationStatus: user.parent ? 'PENDING' : 'VERIFIED', verifiedAt: user.parent ? null : new Date() } });
  }

  async update(id: string, schoolId: string | null, data: UpdateParentDto) {
    const current = await this.findOne(id, schoolId); this.requireSchool(schoolId);
    if (data.schoolId !== undefined && data.schoolId !== schoolId) throw new ForbiddenException('A parent cannot be moved to another school.');
    const mobile = data.mobile !== undefined ? this.mobile(data.mobile) : undefined; const email = data.email !== undefined ? data.email.trim().toLowerCase() : undefined;
    if (mobile || email) { const duplicate = await this.prisma.user.findFirst({ where: { id: { not: current.userId }, OR: [...(mobile ? [{ username: mobile }, { phone: mobile }] : []), ...(email ? [{ email }] : [])] } }); if (duplicate) throw new ConflictException('A login with this mobile number or email already exists.'); }
    return this.prisma.$transaction(async (tx) => {
      if (data.firstName !== undefined || data.lastName !== undefined || mobile !== undefined || email !== undefined) await tx.user.update({ where: { id: current.userId }, data: { ...(data.firstName !== undefined ? { firstName: this.required(data.firstName, 'firstName') } : {}), ...(data.lastName !== undefined ? { lastName: data.lastName.trim() } : {}), ...(mobile !== undefined ? { phone: mobile, username: mobile } : {}), ...(email !== undefined ? { email: email || `${mobile ?? current.user.phone}@login.davi.local` } : {}) } });
      await tx.parentSchoolMembership.update({ where: { parentId_schoolId: { parentId: id, schoolId } }, data: { ...(data.parentCode !== undefined ? { parentCode: this.required(data.parentCode, 'parentCode') } : {}), ...(data.occupation !== undefined ? { occupation: data.occupation.trim() || null } : {}), ...(data.status !== undefined ? { status: data.status } : {}) } });
      return tx.parent.findUniqueOrThrow({ where: { id }, include: parentInclude });
    }).then(async (parent) => this.schoolView(parent, await this.prisma.parentSchoolMembership.findUniqueOrThrow({ where: { parentId_schoolId: { parentId: id, schoolId } } }), schoolId));
  }

  async remove(id: string, schoolId: string | null) { this.requireSchool(schoolId); await this.findOne(id, schoolId); return this.prisma.parentSchoolMembership.delete({ where: { parentId_schoolId: { parentId: id, schoolId } } }); }

  async onboard(schoolId: string | null, data: OnboardParentDto) {
    this.requireSchool(schoolId); const mobile = this.mobile(data.mobile); const firstName = this.required(data.firstName, 'firstName'); const parentCode = this.required(data.parentCode, 'parentCode');
    if (await this.prisma.parentSchoolMembership.findFirst({ where: { schoolId, parentCode } })) throw new ConflictException('Parent code already exists within this school.');
    const existingUser = await this.prisma.user.findFirst({ where: { OR: [{ username: mobile }, { phone: mobile }, ...(data.email ? [{ email: data.email.trim().toLowerCase() }] : [])] }, include: { parent: true } });
    let role = await this.prisma.role.findFirst({ where: { schoolId, code: 'PARENT' } }); if (!role) role = await this.prisma.role.create({ data: { schoolId, name: 'Parent', code: 'PARENT', description: 'Parent portal access' } });
    const temporaryPassword = existingUser ? null : accountCreationPassword();
    const result = await this.prisma.$transaction(async (tx) => {
      const user = existingUser ?? await tx.user.create({ data: { schoolId: null, username: mobile, email: data.email?.trim().toLowerCase() || `${mobile}@login.davi.local`, passwordHash: await bcrypt.hash(temporaryPassword!, 10), firstName, lastName: data.lastName?.trim() || '', phone: mobile, mustChangePassword: true } });
      const parent = existingUser?.parent ?? await tx.parent.create({ data: { userId: user.id } });
      if (await tx.parentSchoolMembership.findUnique({ where: { parentId_schoolId: { parentId: parent.id, schoolId } } })) throw new ConflictException('This parent is already connected to your school.');
      const membership = await tx.parentSchoolMembership.create({ data: { parentId: parent.id, schoolId, parentCode, occupation: data.occupation ?? null, verificationStatus: existingUser ? 'PENDING' : 'VERIFIED', verifiedAt: existingUser ? null : new Date() } });
      await tx.userRole.upsert({ where: { userId_roleId: { userId: user.id, roleId: role.id } }, update: { schoolId }, create: { userId: user.id, roleId: role.id, schoolId } });
      return { parent, user, membership };
    });
    return { message: existingUser ? 'Existing parent found. Verification is required before linking children.' : 'Parent created successfully', parent: this.schoolView({ ...result.parent, user: result.user, memberships: [result.membership], studentParents: [] }, result.membership, schoolId), credentials: temporaryPassword ? { username: mobile, temporaryPassword, mustChangePassword: true } : null, verificationRequired: Boolean(existingUser) };
  }

  async linkStudent(parentId: string, schoolId: string | null, data: LinkParentStudentDto) {
    this.requireSchool(schoolId); const parent = await this.findOne(parentId, schoolId); if (parent.verificationStatus !== 'VERIFIED') throw new ForbiddenException('Parent consent verification is required before linking a student.');
    const enrollment = await this.prisma.studentEnrollment.findFirst({ where: { studentId: data.studentId, schoolId, status: 'ACTIVE' } }); if (!enrollment) throw new NotFoundException('Student is not actively enrolled in your school.');
    if (await this.prisma.studentParent.findUnique({ where: { studentId_parentId: { studentId: data.studentId, parentId } } })) throw new ConflictException('This parent is already linked to the selected student.');
    return this.prisma.$transaction(async (tx) => { if (data.isPrimary) await tx.studentParent.updateMany({ where: { studentId: data.studentId }, data: { isPrimary: false } }); return tx.studentParent.create({ data: { studentId: data.studentId, parentId, relationshipType: data.relationshipType ?? 'guardian', isPrimary: data.isPrimary ?? false, canPickup: data.canPickup ?? true, canViewAcademics: data.canViewAcademics ?? true, canPayFees: data.canPayFees ?? false, status: 'ACTIVE' } }); });
  }

  async unlinkStudent(parentId: string, studentId: string, schoolId: string | null) { this.requireSchool(schoolId); await this.findOne(parentId, schoolId); if (!await this.prisma.studentEnrollment.findFirst({ where: { studentId, schoolId } })) throw new NotFoundException('Student not found for your school.'); const link = await this.prisma.studentParent.findUnique({ where: { studentId_parentId: { studentId, parentId } } }); if (!link) throw new NotFoundException('Parent is not linked to this student.'); return this.prisma.studentParent.delete({ where: { studentId_parentId: { studentId, parentId } } }); }

  async findMyStudents(userId: string) { const parent = await this.prisma.parent.findUnique({ where: { userId } }); if (!parent) throw new ForbiddenException('The logged-in user does not have a Parent profile.'); return this.prisma.studentParent.findMany({ where: { parentId: parent.id, status: 'ACTIVE', canViewAcademics: true }, include: { student: { include: { user: { select: { id: true, firstName: true, lastName: true } }, enrollments: { where: { status: 'ACTIVE' }, include: { school: true, academicYear: true, schoolClass: true, section: true }, orderBy: { createdAt: 'desc' } } } } } }); }

  async enrollmentDashboard(userId: string, enrollmentId: string) { const enrollment = await this.authorizeEnrollment(userId, enrollmentId); const totals = await this.prisma.studentAttendance.groupBy({ by: ['status'], where: { enrollmentId }, _count: { _all: true } }); const marked = totals.reduce((sum, row) => sum + row._count._all, 0); const present = totals.filter((row) => ['PRESENT','LATE','ON_DUTY'].includes(row.status)).reduce((sum, row) => sum + row._count._all, 0); return { enrollment, attendance: { marked, present, percentage: marked ? Math.round(present / marked * 100) : 0, byStatus: Object.fromEntries(totals.map((row) => [row.status, row._count._all])) } }; }
  async enrollmentAttendance(userId: string, enrollmentId: string) { await this.authorizeEnrollment(userId, enrollmentId); return this.prisma.studentAttendance.findMany({ where: { enrollmentId }, orderBy: { date: 'desc' } }); }
  private async authorizeEnrollment(userId: string, enrollmentId: string) { const parent = await this.prisma.parent.findUnique({ where: { userId } }); if (!parent) throw new ForbiddenException('Parent profile required.'); const enrollment = await this.prisma.studentEnrollment.findFirst({ where: { id: enrollmentId, student: { studentParents: { some: { parentId: parent.id, status: 'ACTIVE', canViewAcademics: true } } } }, include: { student: { include: { user: { select: { firstName: true, lastName: true } } } }, school: true, academicYear: true, schoolClass: true, section: true } }); if (!enrollment) throw new ForbiddenException('You cannot access this enrollment.'); return enrollment; }
  private schoolView(parent: any, membership: any, schoolId: string) { const links = (parent.studentParents ?? []).filter((link: any) => link.student.enrollments?.some((enrollment: any) => enrollment.schoolId === schoolId)).map((link: any) => ({ ...link, student: { ...link.student, enrollments: link.student.enrollments.filter((enrollment: any) => enrollment.schoolId === schoolId) } })); if (parent.user) parent.user.passwordHash = undefined; return { ...parent, memberships: undefined, parentCode: membership.parentCode, occupation: membership.occupation, status: membership.status, verificationStatus: membership.verificationStatus, verifiedAt: membership.verifiedAt, studentParents: links }; }
  private required(value: string | undefined, field: string) { if (!value?.trim()) throw new BadRequestException(`${field} is required.`); return value.trim(); }
  private mobile(value: string | undefined) { const digits = value?.replace(/\D/g, '') ?? ''; const normalized = digits.startsWith('91') && digits.length === 12 ? digits.slice(2) : digits; if (!/^[6-9]\d{9}$/.test(normalized)) throw new BadRequestException('mobile must be a valid 10-digit Indian mobile number.'); return normalized; }
  private requireSchool(schoolId: string | null): asserts schoolId is string { if (!schoolId) throw new ForbiddenException('A school account is required.'); }
}
