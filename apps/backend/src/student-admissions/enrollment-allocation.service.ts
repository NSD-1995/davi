import { assignSectionRoll } from '../sections/assign-roll-number';
import { capacityPolicySchema, capacityAllocation, effectiveCapacity, seatCapacity, sectionProposal } from './capacity-rules';
import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { z } from 'zod';
import { PrismaService } from '../prisma/prisma.service';
import { admissionsTransaction } from './admissions-transaction';
import { balancedAllocation, checkVersion, id, instant, parse, reason, text } from './admissions-rules';

const enrollmentInclude = { student: { select: { id: true, user: { select: { firstName: true, lastName: true } } } } };
const sectionPlan = z.object({ key: id, id: id.optional(), name: text, capacity: z.number().int().positive().max(10000), expectedUpdatedAt: instant.optional() }).strict();
const planSchema = z.object({ academicYearId: id, classId: id, sections: z.array(sectionPlan).min(1).max(100), waitlist: z.array(z.object({ enrollmentId: id, version: z.number().int().positive(), reason: text }).strict()).max(2000).optional(), expectedPolicy: z.string().optional() }).strict();
const assignmentsSchema = z.array(z.object({ enrollmentId: id, version: z.number().int().positive(), sectionId: id.nullable(), classId: id.optional(),rollNumber:z.string().trim().max(100).optional() }).strict()).min(1).max(2000);

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
    const settings = await tx.schoolSetting.findUnique({where:{schoolId}});
    const pendingApplications=await tx.admissionApplication.count({where:{schoolId,academicYearId,classId,enrollmentId:null,decision:{notIn:['REJECTED','WITHDRAWN']},joiningStatus:{not:'NOT_JOINED'}}});
    const policy = settings?.sectionCapacityPolicy || {};
    const capacitySummary=schoolClass.sections.filter((s:any)=>s.status==='ACTIVE').map((s:any)=>{const limit=effectiveCapacity(policy,schoolClass,s); const occupied=enrollments.filter((e:any)=>e.sectionId===s.id).length;return {...s,...limit,occupied,available:limit.capacity===null?null:Math.max(0,limit.capacity-occupied),status:limit.capacity===null?'NOT_CONFIGURED':occupied>=limit.capacity?'FULL':occupied/limit.capacity*100>=(policy.nearFullPercent || 90)?'NEAR_FULL':'AVAILABLE'};});
    return { schoolClass, enrollments, total: enrollments.length, unassigned: enrollments.filter((row: any) => !row.sectionId), pendingApplications, capacitySummary, capacityPolicy:policy, expectedPolicy:JSON.stringify(policy) };
  }
  async list(schoolId: string | null, query: unknown) {
    this.school(schoolId); const q = parse(z.object({ academicYearId: id, classId: id }).strict(), query);
    return admissionsTransaction(this.db, tx => this.frame(tx, schoolId, q.academicYearId, q.classId));
  }
  async suggest(schoolId:string|null,body:unknown){
    this.school(schoolId);const data=parse(z.object({academicYearId:id,classId:id,naming:z.enum(['AUTO','NUMERIC','ALPHABETIC']).default('AUTO')}).strict(),body);
    const sections=await admissionsTransaction(this.db,async tx=>{const frame=await this.frame(tx,schoolId,data.academicYearId,data.classId);const occupied=Object.fromEntries(frame.capacitySummary.map((s:any)=>[s.id,s.occupied]));return sectionProposal(frame.schoolClass,frame.capacityPolicy,frame.total+frame.pendingApplications,occupied,data.naming).map((s:any)=>({key:s.key,...(s.id?{id:s.id}:{}),name:s.name,capacity:s.capacity}));});
    if(!sections.length)throw new BadRequestException('No confirmed students need a section yet. Upload an intake list or confirm admissions first.');
    return this.preview(schoolId,{academicYearId:data.academicYearId,classId:data.classId,sections});
  }
  async preview(schoolId: string | null, body: unknown) {
    this.school(schoolId); const plan = parse(planSchema, body);
    return admissionsTransaction(this.db, async tx => {
      const frame = await this.frame(tx, schoolId, plan.academicYearId, plan.classId);
      this.validateSections(frame, plan.sections);
      const result = capacityAllocation(frame.unassigned, plan.sections.map(section => ({ id: section.key, capacity: effectiveCapacity(frame.capacityPolicy,frame.schoolClass,{...frame.schoolClass.sections.find((s:any)=>s.id===section.id),...section}).capacity, occupied: frame.enrollments.filter((row: any) => row.sectionId === section.id).length })),frame.capacityPolicy,plan.academicYearId);
      return { ...plan, expectedPolicy:frame.expectedPolicy, sections: plan.sections.map(section => ({ ...section, ...(section.id ? { expectedUpdatedAt: frame.schoolClass.sections.find((row: any) => row.id === section.id).updatedAt.toISOString() } : {}) })), ...result, total: frame.total, existingAssigned: frame.total - frame.unassigned.length };
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
      const frame = await this.frame(tx, schoolId, data.academicYearId, data.classId); if(data.expectedPolicy !== undefined && data.expectedPolicy!==frame.expectedPolicy) throw new ConflictException('Capacity policy changed. Generate a fresh preview.'); this.validateSections(frame, data.sections);
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
      const reviewed=[...data.assignments,...(data.waitlist || [])];
      if (reviewed.length !== unassigned.size || new Set(reviewed.map(row => row.enrollmentId)).size !== unassigned.size || reviewed.some(row => !unassigned.has(row.enrollmentId) || frame.unassigned.find((e:any)=>e.id===row.enrollmentId)?.version!==row.version)) throw new ConflictException('The unassigned roster changed. Generate a fresh preview.');
      const moves = data.assignments.map(row => { const sectionId = keys.get(row.sectionId); if (!sectionId) throw new BadRequestException('Choose a section from the confirmed plan.'); return { ...row, sectionId, classId: data.classId }; });
      await this.moveInTransaction(tx, schoolId, actorId, moves, data.reason, 'ALLOCATION');
      // A zero-student plan still cannot shrink a section below its existing occupancy.
      for (const section of data.sections) { const count = await tx.studentEnrollment.count({ where: { schoolId, sectionId: keys.get(section.key), academicYearId: data.academicYearId, status: 'ACTIVE' } }); if (count > section.capacity) throw new BadRequestException('Section capacity would be exceeded.'); }
      await tx.auditLog.create({data:{schoolId,actorId,method:'POST',path:'/enrollment-planning/confirm',action:'SECTION_ALLOCATION_APPROVED',entityType:'SchoolClass',entityId:data.classId,metadata:{academicYearId:data.academicYearId,reason:data.reason,beforeSections:frame.schoolClass.sections,sections:data.sections,assignments:data.assignments,waitlist:data.waitlist || []}}});
      return this.frame(tx, schoolId, data.academicYearId, data.classId);
    });
  }
  async move(schoolId: string | null, actorId: string, body: unknown) {
    this.school(schoolId); const data = parse(z.object({ assignments: assignmentsSchema, reason }).strict(), body);
    return admissionsTransaction(this.db, async tx => { await this.permission(tx,schoolId,actorId,'ENROLLMENT_MOVE'); await this.moveInTransaction(tx, schoolId, actorId, data.assignments, data.reason, 'TRANSFER'); return { moved: data.assignments.length }; });
  }
  async moveInTransaction(tx: any, schoolId: string, actorId: string, assignments: Array<{ enrollmentId: string; version: number; sectionId: string | null; classId?: string;rollNumber?:string }>, reason: string, kind: string) {
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
        const capacity=await seatCapacity(tx,schoolId,before.academicYearId,classId,section);
        const constraint=(policy?.sectionCapacityPolicy as any)?.constraints?.find((c:any)=>c.academicYearId===before.academicYearId && c.enrollmentId===before.id);
        if(constraint && !constraint.allowedSectionIds.includes(section.id)) throw new BadRequestException('Student constraint excludes this section.');
        if (capacity === null) throw new BadRequestException('Configure section capacity before assigning students.');
        targets.set(section.id, { yearId: before.academicYearId, capacity });
      }
    }
    // Check final occupancy as a batch, allowing swaps between full sections.
    for (const [sectionId, target] of [...targets].sort(([a],[b]) => a.localeCompare(b))) {
      // Serialize competing seat reservations before counting final occupancy.
      await tx.section.update({ where: { id: sectionId }, data: { updatedAt: new Date() } });
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
      if (before.classId === classId && before.sectionId === assignment.sectionId){if(assignment.rollNumber!==undefined){const rollNumber=await assignSectionRoll(tx,schoolId,before.academicYearId,assignment.sectionId,assignment.rollNumber,before.id);await tx.studentEnrollment.update({where:{id:before.id},data:{rollNumber,version:{increment:1}}});await tx.auditLog.create({data:{schoolId,actorId,method:'POST',path:'/enrollment-planning/moves',action:'ROLL_NUMBER_UPDATED',entityType:'StudentEnrollment',entityId:before.id,metadata:{before:before.rollNumber,after:rollNumber,reason}}});}continue;}
      await tx.studentEnrollment.update({ where: { id: before.id }, data: { classId, sectionId: assignment.sectionId, rollNumber:await assignSectionRoll(tx,schoolId,before.academicYearId,assignment.sectionId,assignment.rollNumber,before.id), version: { increment: 1 } } });
      await tx.auditLog.create({data:{schoolId,actorId,method:'POST',path:'/enrollment-planning/moves',action:kind,entityType:'StudentEnrollment',entityId:before.id,metadata:{academicYearId:before.academicYearId,fromSectionId:before.sectionId,toSectionId:assignment.sectionId,previousRollNumber:before.rollNumber,rollNumber:(await tx.studentEnrollment.findUnique({where:{id:before.id},select:{rollNumber:true}})).rollNumber,reason}}});
      await tx.enrollmentMovement.create({ data: { schoolId, enrollmentId: before.id, kind, fromClassId: before.classId, fromSectionId: before.sectionId, toClassId: classId, toSectionId: assignment.sectionId, reason: before.rollNumber ? reason+' Previous roll number: '+before.rollNumber : reason, actorId } });
    }
  }
  async saveCapacityPolicy(schoolId:string|null,actorId:string,body:unknown){
    this.school(schoolId);const data=parse(z.object({policy:capacityPolicySchema,expectedPolicy:z.string(),reason}).strict(),body);
    return admissionsTransaction(this.db,async tx=>{
      await this.permission(tx,schoolId,actorId,'SECTION_UPDATE');
      const settings=await tx.schoolSetting.findUnique({where:{schoolId}});
      if(JSON.stringify(settings?.sectionCapacityPolicy || {})!==data.expectedPolicy)throw new ConflictException('Policy changed. Refresh before saving.');
      for(const rule of data.policy.rules){
        if(!await tx.academicYear.findFirst({where:{id:rule.academicYearId,schoolId}}))throw new BadRequestException('Policy year must belong to this school.');
        if(rule.level==='ACADEMIC_LEVEL' && !await tx.schoolClass.findFirst({where:{schoolId,academicYearId:rule.academicYearId,academicGroup:rule.target}}))throw new BadRequestException('Academic level must belong to this school/year.');
        if(rule.level==='CLASSROOM' && !await tx.section.findFirst({where:{schoolId,room:rule.target,schoolClass:{academicYearId:rule.academicYearId}}}))throw new BadRequestException('Choose an existing classroom in this school/year.');
        if(rule.level==='GRADE' && !await tx.schoolClass.findFirst({where:{id:rule.target,schoolId,academicYearId:rule.academicYearId}}))throw new BadRequestException('Invalid grade scope.');
        if(rule.level==='SECTION' && !await tx.section.findFirst({where:{id:rule.target,schoolId,schoolClass:{academicYearId:rule.academicYearId}}}))throw new BadRequestException('Invalid section scope.');
      }
      for(const constraint of data.policy.constraints){
        const enrollment=await tx.studentEnrollment.findFirst({where:{id:constraint.enrollmentId,schoolId,academicYearId:constraint.academicYearId,status:'ACTIVE'}});
        if(!enrollment)throw new BadRequestException('Constraint enrollment not found in school/year.');
        const sectionIds=[...new Set([...constraint.allowedSectionIds,...constraint.preferredSectionIds])];
        if(await tx.section.count({where:{id:{in:sectionIds},schoolId,classId:enrollment.classId,status:'ACTIVE'}})!==sectionIds.length)throw new BadRequestException('Constraint sections must belong to the enrollment class.');
      }
      const classes=await tx.schoolClass.findMany({where:{schoolId},include:{sections:true}});
      for(const c of classes)for(const section of c.sections){const cap=effectiveCapacity(data.policy,c,section).capacity;const count=await tx.studentEnrollment.count({where:{schoolId,academicYearId:c.academicYearId,sectionId:section.id,status:'ACTIVE'}});if(cap!==null && count>cap)throw new BadRequestException('Policy would exceed occupied capacity in '+c.name+' / '+section.name);}
      await tx.schoolSetting.upsert({where:{schoolId},create:{schoolId,sectionCapacityPolicy:data.policy},update:{sectionCapacityPolicy:data.policy}});
      await tx.auditLog.create({data:{schoolId,actorId,method:'POST',path:'/enrollment-planning/capacity-policy',action:'CAPACITY_POLICY_CHANGED',metadata:{before:settings?.sectionCapacityPolicy || {},after:data.policy,reason:data.reason}}});
      return {saved:true};
    });
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
      if (data.sectionId) { const section = await tx.section.findFirst({ where: { id: data.sectionId, schoolId, classId: data.classId, status: 'ACTIVE' } }); if (!section) throw new BadRequestException('Choose a target section with configured capacity.'); await tx.section.update({where:{id:section.id},data:{capacity:section.capacity}}); const capacity=await seatCapacity(tx,schoolId,data.academicYearId,data.classId,section); const count = await tx.studentEnrollment.count({ where: { schoolId, academicYearId: data.academicYearId, sectionId: data.sectionId, status: 'ACTIVE' } }); if (capacity===null || count + rows.length > capacity) throw new BadRequestException('Target section capacity exceeded.'); }
      const policy = await tx.schoolSetting.findUnique({ where: { schoolId } }); if (policy?.admissionsPolicy?.requireSectionOnJoin && !data.sectionId) throw new BadRequestException('This school requires a section for new enrollments.');
      for (const before of rows) {
        const next = await tx.studentEnrollment.create({ data: { schoolId, studentId: before.studentId, academicYearId: data.academicYearId, classId: data.classId, sectionId: data.sectionId,rollNumber:await assignSectionRoll(tx,schoolId,data.academicYearId,data.sectionId), admissionNumber: before.admissionNumber } });
        await tx.studentEnrollment.update({ where: { id: before.id }, data: { status: 'PROMOTED', version: { increment: 1 } } });
        await tx.enrollmentMovement.create({ data: { schoolId, enrollmentId: next.id, kind: 'PROMOTION', fromClassId: before.classId, fromSectionId: before.sectionId, toClassId: data.classId, toSectionId: data.sectionId, reason: data.reason, actorId } });
      } return { promoted: rows.length };
    });
  }
}
