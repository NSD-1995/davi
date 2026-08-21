import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs'; import { randomBytes } from 'crypto'; import { PrismaService } from '../prisma/prisma.service'; import { CreateStudentAdmissionDto } from './student-admissions.dto';
@Injectable()
export class StudentAdmissionsService {
  constructor(private readonly prisma: PrismaService) {}
  async create(schoolId: string | null, data: CreateStudentAdmissionDto) {
    if (!schoolId) throw new ForbiddenException('A school account is required.');
    if (!Array.isArray(data.parents) || data.parents.length < 1 || data.parents.length > 2) throw new BadRequestException('Provide one or two parents or guardians.');
    if (data.parents.filter(parent => parent.isPrimary).length !== 1) throw new BadRequestException('Exactly one parent or guardian must be primary.');
    const admissionNumber = this.required(data.student?.admissionNumber, 'admissionNumber');
    if (await this.prisma.student.findFirst({ where: { schoolId, admissionNumber } })) throw new ConflictException('Admission number already exists within this school.');
    const { academicYearId, classId, sectionId } = data.enrollment ?? {}; const year = await this.prisma.academicYear.findFirst({ where: { id: academicYearId, schoolId } }); if (!year) throw new NotFoundException('Academic year not found for your school.'); const schoolClass = await this.prisma.schoolClass.findFirst({ where: { id: classId, schoolId, academicYearId } }); if (!schoolClass) throw new BadRequestException('Class must belong to the selected academic year.'); const section = sectionId ? await this.prisma.section.findFirst({ where: { id: sectionId, schoolId, classId } }) : null; if (sectionId && !section) throw new BadRequestException('Section must belong to the selected class.');
    const parentInputs = data.parents.map(parent => ({ ...parent, mobile: this.mobile(parent.mobile) }));
    if (new Set(parentInputs.map(parent => parent.mobile)).size !== parentInputs.length) throw new BadRequestException('Each parent must have a different mobile number.');
    const passwordHash = await bcrypt.hash(randomBytes(24).toString('base64url'), 10);
    return this.prisma.$transaction(async tx => {
      const studentUser = await tx.user.create({ data: { schoolId, username: `student-${admissionNumber}`, email: `student-${admissionNumber}-${randomBytes(4).toString('hex')}@internal.davi.local`, passwordHash, firstName: this.required(data.student.firstName, 'student.firstName'), lastName: data.student.lastName?.trim() || '', mustChangePassword: false } });
      const student = await tx.student.create({ data: { schoolId, userId: studentUser.id, studentCode: admissionNumber, admissionNumber, birthDate: data.student.dateOfBirth ? new Date(data.student.dateOfBirth) : null, gender: data.student.gender } });
      const enrollment = await tx.studentEnrollment.create({ data: { schoolId, studentId: student.id, academicYearId, classId, sectionId, rollNumber: data.enrollment.rollNumber?.trim() || null }, include: { academicYear: true, schoolClass: true, section: true } });
      const linkedParents = [];
      for (const parentInput of parentInputs) {
        let parent = await tx.parent.findFirst({ where: { schoolId, user: { username: parentInput.mobile } }, include: { user: true } });
        if (!parent) { let role = await tx.role.findFirst({ where: { schoolId, code: 'PARENT' } }); if (!role) role = await tx.role.create({ data: { schoolId, name: 'Parent', code: 'PARENT', description: 'Parent portal access' } }); const parentUser = await tx.user.create({ data: { schoolId, username: parentInput.mobile, email: parentInput.email?.trim().toLowerCase() || `${parentInput.mobile}@login.davi.local`, passwordHash, firstName: this.required(parentInput.firstName, 'parent.firstName'), lastName: parentInput.lastName?.trim() || '', phone: parentInput.mobile, mustChangePassword: true } }); parent = await tx.parent.create({ data: { schoolId, userId: parentUser.id, parentCode: `P-${parentInput.mobile}` }, include: { user: true } }); await tx.userRole.create({ data: { userId: parentUser.id, roleId: role.id, schoolId } }); }
        await tx.studentParent.create({ data: { studentId: student.id, parentId: parent.id, relationshipType: parentInput.relationship?.trim() || 'guardian', isPrimary: parentInput.isPrimary } }); linkedParents.push({ ...parent, isPrimary: parentInput.isPrimary, relationship: parentInput.relationship?.trim() || 'guardian' });
      }
      return { student: { ...student, user: { id: studentUser.id, firstName: studentUser.firstName, lastName: studentUser.lastName } }, enrollment, class: schoolClass, section, parents: linkedParents, primaryParent: linkedParents.find(parent => parent.isPrimary) };
    });
  }
  private required(value: string | undefined, field: string) { if (!value?.trim()) throw new BadRequestException(`${field} is required.`); return value.trim(); }
  private mobile(value: string) { const digits = value.replace(/\D/g, ''); const normalized = digits.startsWith('91') && digits.length === 12 ? digits.slice(2) : digits; if (!/^[6-9]\d{9}$/.test(normalized)) throw new BadRequestException('mobile must be a valid 10-digit Indian mobile number.'); return normalized; }
}
