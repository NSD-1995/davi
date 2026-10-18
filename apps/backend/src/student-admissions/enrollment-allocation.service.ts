import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { z } from 'zod';
import { PrismaService } from '../prisma/prisma.service';
import { admissionsTransaction } from './admissions-transaction';
import { balancedAllocation, checkVersion, id, instant, parse, reason, text } from './admissions-rules';

const enrollmentInclude = { student: { select: { id: true, user: { select: { firstName: true, lastName: true } } } } };
const sectionPlan = z.object({ key: id, id: id.optional(), name: text, capacity: z.number().int().positive().max(10000), expectedUpdatedAt: instant.optional() }).strict();
const planSchema = z.object({ academicYearId: id, classId: id, sections: z.array(sectionPlan).min(1).max(100) }).strict();
const assignmentsSchema = z.array(z.object({ enrollmentId: id, version: z.number().int().positive(), sectionId: id.nullable(), classId: id.optional() }).strict()).min(1).max(2000);

@Injectable()
export class EnrollmentAllocationService {
  constructor(private readonly db: PrismaService) {}
  school(schoolId: string | null): asserts schoolId is string { if (!schoolId) throw new ForbiddenException('A school account is required.'); }
  async lookups(schoolId: string | null) { this.school(schoolId); const [years, classes] = await Promise.all([this.db.academicYear.findMany({ where: { schoolId }, orderBy: { createdAt: 'desc' } }), this.db.schoolClass.findMany({ where: { schoolId }, include: { sections: true }, orderBy: { createdAt: 'asc' } })]); return { years, classes }; }
  async permission(tx: any, schoolId: string, actorId: string, code: string) {
    const roles = await tx.userRole.findMany({ where: { userId: actorId, schoolId, user:{status:'ACTIVE'}, role: { schoolId, isActive: true } }, include: { role: { include: { rolePermissions: { include: { permission: true } } } } } });
    if (!roles.some((assignment: any) => assignment.role.code === 'SCHOOL_ADMIN' || assignment.role.rolePermissions.some((mapping: any) => mapping.permission.code === code))) throw new ForbiddenException(`Missing required permission: ${code}`);
  }
  async frame(tx: any, schoolId: string, academicYearId: string, classId: string) {
    const schoolClass = await tx.schoolClass.findFirst({ where: { id: classId, schoolId, academicYearId }, include: { sections: { orderBy: { name: 'asc' } } } });
    if (!schoolClass) throw new NotFoundException('Class not found for this school and academic year.');
    const enrollments = await tx.studentEnrollment.findMany({ where: { schoolId, academicYearId, classId, status: 'ACTIVE' }, include: enrollmentInclude, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] });
    return { schoolClass, enrollments, total: enrollments.length, unassigned: enrollments.filter((row: any) => !row.sectionId) };
  }
  async list(schoolId: string | null, query: unknown) {
    this.school(schoolId); const q = parse(z.object({ academicYearId: id, classId: id }).strict(), query);
    return admissionsTransaction(this.db, tx => this.frame(tx, schoolId, q.academicYearId, q.classId));
  }
  async preview(schoolId: string | null, body: unknown) {
    this.school(schoolId); const plan = parse(planSchema, body);
    return admissionsTransaction(this.db, async tx => {
      const frame = await this.frame(tx, schoolId, plan.academicYearId, plan.classId);
      this.validateSections(frame, plan.sections);
      const result = balancedAllocation(frame.unassigned, plan.sections.map(section => ({ id: section.key, capacity: section.capacity, occupied: frame.enrollments.filter((row: any) => row.sectionId === section.id).length })));
      return { ...plan, sections: plan.sections.map(section => ({ ...section, ...(section.id ? { expectedUpdatedAt: frame.schoolClass.sections.find((row: any) => row.id === section.id).updatedAt.toISOString() } : {}) })), ...result, total: frame.total, existingAssigned: frame.total - frame.unassigned.length };
    });
  }
  validateSections(frame: any, sections: z.infer<typeof sectionPlan>[]) {
    if (new Set(sections.map(section => section.key)).size !== sections.length || new Set(sections.map(section => section.name.toLowerCase())).size !== sections.length) throw new BadRequestException('Section keys and names must be distinct.');
    const ids = sections.flatMap(section => section.id ? [section.id] : []);
    if (new Set(ids).size !== ids.length) throw new BadRequestException('Duplicate existing section.');
    for (const section of sections) {
      if (section.id) { const existing = frame.schoolClass.sections.find((row: any) => row.id === section.id && row.status === 'ACTIVE'); if (!existing || existing.name !== section.name) throw new BadRequestException('Existing sections must belong to this class and keep their names.'); }
      else if (frame.schoolClass.sections.some((row: any) => row.name.toLowerCase() === section.name.toLowerCase())) throw new ConflictException('A proposed section name already exists.');
    }
  }
  async confirm(schoolId: string | null, actorId: string, body: unknown) {
    this.school(schoolId); const data = parse(planSchema.extend({ assignments: z.array(z.object({ enrollmentId: id, version: z.number().int().positive(), sectionId: id }).strict()).max(2000), reason, confirmCreateSections: z.boolean() }).strict(), body);
    return admissionsTransaction(this.db, async tx => {
      await this.permission(tx,schoolId,actorId,'ENROLLMENT_ALLOCATE');
      const frame = await this.frame(tx, schoolId, data.academicYearId, data.classId); this.validateSections(frame, data.sections);
      for (const section of data.sections) if (section.id && (!section.expectedUpdatedAt || frame.schoolClass.sections.find((row: any) => row.id === section.id).updatedAt.toISOString() !== section.expectedUpdatedAt)) throw new ConflictException('Section configuration changed. Generate a fresh preview.');
      if (data.sections.some(section => !section.id)) { if (!data.confirmCreateSections) throw new BadRequestException('Explicitly confirm new section creation.'); await this.permission(tx, schoolId, actorId, 'SECTION_CREATE'); }
      const keys = new Map<string,string>();
      for (const section of data.sections) {
        if (section.id) {
          const existing = frame.schoolClass.sections.find((row: any) => row.id === section.id);
          if (section.capacity !== existing.capacity) { await this.permission(tx, schoolId, actorId, 'SECTION_UPDATE'); await tx.section.update({ where: { id: section.id }, data: { capacity: section.capacity } }); }
          keys.set(section.key, section.id);
        } else { const created = await tx.section.create({ data: { schoolId, classId: data.classId, name: section.name, capacity: section.capacity, status: 'ACTIVE' } }); keys.set(section.key, created.id); }
      }
      const unassigned = new Set(frame.unassigned.map((row: any) => row.id));
      if (data.assignments.length !== unassigned.size || new Set(data.assignments.map(row => row.enrollmentId)).size !== unassigned.size || data.assignments.some(row => !unassigned.has(row.enrollmentId))) throw new ConflictException('The unassigned roster changed. Generate a fresh preview.');
      const moves = data.assignments.map(row => { const sectionId = keys.get(row.sectionId); if (!sectionId) throw new BadRequestException('Choose a section from the confirmed plan.'); return { ...row, sectionId, classId: data.classId }; });
      await this.moveInTransaction(tx, schoolId, actorId, moves, data.reason, 'ALLOCATION');
      // A zero-student plan still cannot shrink a section below its existing occupancy.
      for (const section of data.sections) { const count = await tx.studentEnrollment.count({ where: { schoolId, sectionId: keys.get(section.key), academicYearId: data.academicYearId, status: 'ACTIVE' } }); if (count > section.capacity) throw new BadRequestException('Section capacity would be exceeded.'); }
      return this.frame(tx, schoolId, data.academicYearId, data.classId);
    });
  }
  async move(schoolId: string | null, actorId: string, body: unknown) {
    this.school(schoolId); const data = parse(z.object({ assignments: assignmentsSchema, reason }).strict(), body);
    return admissionsTransaction(this.db, async tx => { await this.permission(tx,schoolId,actorId,'ENROLLMENT_MOVE'); await this.moveInTransaction(tx, schoolId, actorId, data.assignments, data.reason, 'TRANSFER'); return { moved: data.assignments.length }; });
  }
  async moveInTransaction(tx: any, schoolId: string, actorId: string, assignments: Array<{ enrollmentId: string; version: number; sectionId: string | null; classId?: string }>, reason: string, kind: string) {
    const ids = assignments.map(row => row.enrollmentId);
    if (new Set(ids).size !== ids.length) throw new BadRequestException('Each enrollment must appear once.');
    const rows = await tx.studentEnrollment.findMany({ where: { id: { in: ids }, schoolId, status: 'ACTIVE' } });
    if (rows.length !== ids.length) throw new NotFoundException('One or more active enrollments were not found in this school.');
    const targets = new Map<string, { yearId: string; capacity: number | null }>();
    for (const assignment of assignments) {
      const before = rows.find((row: any) => row.id === assignment.enrollmentId); checkVersion(before.version, assignment.version);
      const classId = assignment.classId || before.classId;
      const policy = await tx.schoolSetting.findUnique({ where: { schoolId } });
      if (policy?.admissionsPolicy?.requireSectionOnJoin && !assignment.sectionId) throw new BadRequestException('This school requires a section for active enrollments.');
      if (!await tx.schoolClass.findFirst({ where: { id: classId, schoolId, academicYearId: before.academicYearId, status: 'ACTIVE' } })) throw new BadRequestException('Target class must belong to the same school and academic year.');
      if (assignment.sectionId) {
        const section = await tx.section.findFirst({ where: { id: assignment.sectionId, schoolId, classId, status: 'ACTIVE' } });
        if (!section) throw new BadRequestException('Target section must belong to the target class and school.');
        if (section.capacity === null) throw new BadRequestException('Configure section capacity before assigning students.');
        targets.set(section.id, { yearId: before.academicYearId, capacity: section.capacity });
      }
    }
    // Check final occupancy as a batch, allowing swaps between full sections.
    for (const [sectionId, target] of [...targets].sort(([a],[b]) => a.localeCompare(b))) {
      // Serialize competing seat reservations before counting final occupancy.
      await tx.section.update({ where: { id: sectionId }, data: { capacity: target.capacity } });
      const fixed = await tx.studentEnrollment.count({ where: { schoolId, academicYearId: target.yearId, sectionId, status: 'ACTIVE', id: { notIn: ids } } });
      const incoming = assignments.filter(assignment => assignment.sectionId === sectionId && rows.find((row: any) => row.id === assignment.enrollmentId).academicYearId === target.yearId).length;
      if (fixed + incoming > target.capacity!) throw new BadRequestException('The proposed allocation exceeds section capacity.');
    }
    for (const assignment of assignments) {
      const before = rows.find((row: any) => row.id === assignment.enrollmentId); const classId = assignment.classId || before.classId;
      if (before.classId === classId && before.sectionId === assignment.sectionId) continue;
      // Snapshot legacy facts before changing the current enrollment's location.
      await tx.studentAttendance.updateMany({ where: { enrollmentId: before.id, classIdSnapshot: null }, data: { classIdSnapshot: before.classId, sectionIdSnapshot: before.sectionId } });
      await tx.studentMark.updateMany({ where: { enrollmentId: before.id, locationSnapshotted: false }, data: { sectionIdSnapshot: before.sectionId, locationSnapshotted: true } });
      // Null rolls temporarily so same-class swaps cannot trip the unique roll constraint.
      await tx.studentEnrollment.update({ where: { id: before.id }, data: { rollNumber: null } });
    }
    for (const assignment of assignments) {
      const before = rows.find((row: any) => row.id === assignment.enrollmentId); const classId = assignment.classId || before.classId;
      if (before.classId === classId && before.sectionId === assignment.sectionId) continue;
      await tx.studentEnrollment.update({ where: { id: before.id }, data: { classId, sectionId: assignment.sectionId, rollNumber: null, version: { increment: 1 } } });
      await tx.enrollmentMovement.create({ data: { schoolId, enrollmentId: before.id, kind, fromClassId: before.classId, fromSectionId: before.sectionId, toClassId: classId, toSectionId: assignment.sectionId, reason: before.rollNumber ? reason+' Previous roll number: '+before.rollNumber : reason, actorId } });
    }
  }
  async history(schoolId: string | null, enrollmentId: string) { this.school(schoolId); if (!await this.db.studentEnrollment.findFirst({ where: { id: enrollmentId, schoolId } })) throw new NotFoundException('Enrollment not found.'); return this.db.enrollmentMovement.findMany({ where: { schoolId, enrollmentId }, orderBy: { createdAt: 'desc' } }); }
  async promote(schoolId: string | null, actorId: string, body: unknown) {
    this.school(schoolId); const data = parse(z.object({ enrollmentIds: z.array(z.object({ id, version: z.number().int().positive() }).strict()).min(1).max(1000), academicYearId: id, classId: id, sectionId: id.nullable(), reason }).strict(), body);
    return admissionsTransaction(this.db, async tx => {
      await this.permission(tx,schoolId,actorId,'ENROLLMENT_PROMOTE');
      const target = await tx.schoolClass.findFirst({ where: { id: data.classId, schoolId, academicYearId: data.academicYearId, status: 'ACTIVE' } }); if (!target) throw new BadRequestException('Choose a target class in the new academic year.');
      if (new Set(data.enrollmentIds.map(row => row.id)).size !== data.enrollmentIds.length) throw new BadRequestException('Duplicate enrollment IDs.');
      const rows = await tx.studentEnrollment.findMany({ where: { id: { in: data.enrollmentIds.map(row => row.id) }, schoolId, status: 'ACTIVE' } }); if (rows.length !== data.enrollmentIds.length) throw new NotFoundException('Active enrollments not found.');
      const year = await tx.academicYear.findFirst({ where: { id: data.academicYearId, schoolId } });
      for (const before of rows) { checkVersion(before.version, data.enrollmentIds.find(row => row.id === before.id)!.version); if (before.academicYearId === data.academicYearId) throw new BadRequestException('Promotion must target a different academic year.'); const sourceYear = await tx.academicYear.findFirst({ where: { id: before.academicYearId, schoolId } }); if (!year.startDate || !sourceYear.startDate || year.startDate <= sourceYear.startDate) throw new BadRequestException('Promotion requires dated academic years in forward order.'); }
      if (data.sectionId) { const section = await tx.section.findFirst({ where: { id: data.sectionId, schoolId, classId: data.classId, status: 'ACTIVE' } }); if (!section || section.capacity === null) throw new BadRequestException('Choose a target section with configured capacity.'); await tx.section.update({where:{id:section.id},data:{capacity:section.capacity}}); const count = await tx.studentEnrollment.count({ where: { schoolId, academicYearId: data.academicYearId, sectionId: data.sectionId, status: 'ACTIVE' } }); if (count + rows.length > section.capacity) throw new BadRequestException('Target section capacity exceeded.'); }
      const policy = await tx.schoolSetting.findUnique({ where: { schoolId } }); if (policy?.admissionsPolicy?.requireSectionOnJoin && !data.sectionId) throw new BadRequestException('This school requires a section for new enrollments.');
      for (const before of rows) {
        const next = await tx.studentEnrollment.create({ data: { schoolId, studentId: before.studentId, academicYearId: data.academicYearId, classId: data.classId, sectionId: data.sectionId, admissionNumber: before.admissionNumber } });
        await tx.studentEnrollment.update({ where: { id: before.id }, data: { status: 'PROMOTED', version: { increment: 1 } } });
        await tx.enrollmentMovement.create({ data: { schoolId, enrollmentId: next.id, kind: 'PROMOTION', fromClassId: before.classId, fromSectionId: before.sectionId, toClassId: data.classId, toSectionId: data.sectionId, reason: data.reason, actorId } });
      } return { promoted: rows.length };
    });
  }
}
