import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { CreateStaffDto, UpdateStaffDto } from './staff.dto';

@Injectable()
export class StaffService {
  constructor(private readonly prisma: PrismaService) {}
  async findAll(schoolId: string, actorSchoolId: string | null) { this.school(schoolId, actorSchoolId); const staff = await this.prisma.staff.findMany({ where: { schoolId }, include: { user: { include: { roles: { include: { role: true } } } } }, orderBy: { createdAt: 'asc' } }); return staff.map((item) => this.safe(item)); }
  async findOne(schoolId: string, id: string, actorSchoolId: string | null) { this.school(schoolId, actorSchoolId); const staff = await this.prisma.staff.findFirst({ where: { id, schoolId }, include: { user: { include: { roles: { include: { role: true } } } } } }); if (!staff) throw new NotFoundException('Staff member not found for this school.'); return this.safe(staff); }
  async create(schoolId: string, actorSchoolId: string | null, data: CreateStaffDto) {
    this.school(schoolId, actorSchoolId); const mobile = this.mobile(data.mobile); const firstName = this.required(data.firstName, 'firstName'); const employeeId = this.required(data.employeeId, 'employeeId');
    const role = await this.prisma.role.findFirst({ where: { id: data.roleId, schoolId, isActive: true } }); if (!role) throw new NotFoundException('Active role not found for this school.');
    if (await this.prisma.user.findFirst({ where: { OR: [{ username: mobile }, ...(data.email ? [{ email: data.email.trim().toLowerCase() }] : [])] } })) throw new ConflictException('A user with this mobile number or email already exists.');
    if (await this.prisma.staff.findUnique({ where: { schoolId_employeeId: { schoolId, employeeId } } })) throw new ConflictException('Employee ID already exists within this school.');
    const temporaryPassword = `DAVI-${randomBytes(6).toString('base64url')}`; const passwordHash = await bcrypt.hash(temporaryPassword, 10); const email = data.email?.trim().toLowerCase() || `${mobile}@login.davi.local`;
    const staff = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({ data: { schoolId, username: mobile, email, passwordHash, firstName, lastName: data.lastName?.trim() || '', phone: mobile, mustChangePassword: true } });
      const created = await tx.staff.create({ data: { schoolId, userId: user.id, employeeId, joiningDate: data.joiningDate ? new Date(data.joiningDate) : null } });
      await tx.userRole.create({ data: { userId: user.id, roleId: role.id, schoolId } });
      return tx.staff.findUniqueOrThrow({ where: { id: created.id }, include: { user: { include: { roles: { include: { role: true } } } } } });
    });
    return { message: 'Staff created successfully', staff: this.safe(staff), credentials: { username: mobile, temporaryPassword, mustChangePassword: true } };
  }
  async update(schoolId: string, id: string, actorSchoolId: string | null, data: UpdateStaffDto) {
    const staff = await this.findOne(schoolId, id, actorSchoolId); let role = null;
    if (data.roleId) { role = await this.prisma.role.findFirst({ where: { id: data.roleId, schoolId, isActive: true } }); if (!role) throw new NotFoundException('Active role not found for this school.'); }
    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: staff.userId }, data: { ...(data.firstName !== undefined ? { firstName: this.required(data.firstName, 'firstName') } : {}), ...(data.lastName !== undefined ? { lastName: data.lastName } : {}), ...(data.email !== undefined ? { email: data.email.toLowerCase() } : {}), ...(data.status !== undefined ? { status: data.status } : {}) } });
      await tx.staff.update({ where: { id }, data: { ...(data.employeeId !== undefined ? { employeeId: this.required(data.employeeId, 'employeeId') } : {}), ...(data.joiningDate !== undefined ? { joiningDate: new Date(data.joiningDate) } : {}), ...(data.status !== undefined ? { status: data.status } : {}) } });
      if (role) { await tx.userRole.deleteMany({ where: { userId: staff.userId, schoolId } }); await tx.userRole.create({ data: { userId: staff.userId, roleId: role.id, schoolId } }); }
      return tx.staff.findUniqueOrThrow({ where: { id }, include: { user: { include: { roles: { include: { role: true } } } } } });
    });
    return this.safe(updated);
  }
  async deactivate(schoolId: string, id: string, actorSchoolId: string | null) { const staff = await this.findOne(schoolId, id, actorSchoolId); await this.prisma.$transaction([this.prisma.staff.update({ where: { id }, data: { status: 'INACTIVE' } }), this.prisma.user.update({ where: { id: staff.userId }, data: { status: 'INACTIVE' } })]); return { message: 'Staff deactivated successfully.', id }; }
  private school(schoolId: string, actorSchoolId: string | null) { if (!actorSchoolId || schoolId !== actorSchoolId) throw new ForbiddenException('You can only manage staff for your own school.'); }
  private required(value: string | undefined, field: string) { if (!value?.trim()) throw new BadRequestException(`${field} is required.`); return value.trim(); }
  private mobile(value: string | undefined) { const digits = value?.replace(/\D/g, '') ?? ''; const normalized = digits.startsWith('91') && digits.length === 12 ? digits.slice(2) : digits; if (!/^[6-9]\d{9}$/.test(normalized)) throw new BadRequestException('mobile must be a valid 10-digit Indian mobile number.'); return normalized; }
  private safe(staff: any) { if (staff.user) staff.user.passwordHash = undefined; return staff; }
}
