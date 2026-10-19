import { assignSectionRoll } from '../sections/assign-roll-number';
import { capacityAllocation, effectiveCapacity, seatCapacity } from './capacity-rules';
import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import { accountCreationPassword } from '../auth/development-password';
import { PrismaService } from '../prisma/prisma.service';
import { admissionsTransaction } from './admissions-transaction';
import { CreateStudentAdmissionDto } from './student-admissions.dto';

@Injectable()
export class StudentAdmissionsService {
  constructor(private readonly prisma: PrismaService) {}
  async create(schoolId: string | null, data: CreateStudentAdmissionDto, transaction?: any, actorId?: string, migration?: { verifiedParentIds: string[] }) {
    const db = transaction || this.prisma;
    if (!schoolId) throw new ForbiddenException('A school account is required.');
    if (!Array.isArray(data.parents) || data.parents.length < 1 || data.parents.length > 2) throw new BadRequestException('Provide one or two parents or guardians.');
    if (data.parents.filter((parent) => parent.isPrimary).length !== 1) throw new BadRequestException('Exactly one parent or guardian must be primary.');
    const admissionNumber = data.student?.admissionNumber?.trim() || ''; const { academicYearId, classId } = data.enrollment ?? {};
    if (admissionNumber && await db.studentEnrollment.findFirst({ where: { schoolId, academicYearId, admissionNumber } })) throw new ConflictException('Admission number already exists for this academic year and school.');
    const year = await db.academicYear.findFirst({ where: { id: academicYearId, schoolId } }); if (!year) throw new NotFoundException('Academic year not found for your school.');
    const schoolClass = await db.schoolClass.findFirst({ where: { id: classId, schoolId, academicYearId } }); if (!schoolClass) throw new BadRequestException('Class must belong to the selected academic year.');
    const requestedSectionId=data.enrollment?.sectionId;
    const sectionId=requestedSectionId;
    const section = sectionId ? await db.section.findFirst({ where: { id: sectionId, schoolId, classId } }) : null; if (sectionId && !section) throw new BadRequestException('Section must belong to the selected class.');
    const parentInputs = data.parents.map((parent) => ({ ...parent, mobile: this.mobile(parent.mobile) })); if (new Set(parentInputs.map((parent) => parent.mobile)).size !== parentInputs.length) throw new BadRequestException('Each parent must have a different mobile number.');
    const temporaryPassword = accountCreationPassword(); const passwordHash = await bcrypt.hash(temporaryPassword, 10);
    const execute = async (tx: any) => {
      let admissionNumber=data.student?.admissionNumber?.trim() || '';
      if(!admissionNumber){
        const school=await tx.school.update({where:{id:schoolId},data:{updatedAt:new Date()},select:{shortName:true}});
        const prefix=school.shortName?.trim().toUpperCase().replace(/[^A-Z0-9]/g,'');
        if(!prefix)throw new BadRequestException('Set the school short name before generating admission numbers.');
        const existing=await tx.studentEnrollment.findMany({where:{schoolId,admissionNumber:{startsWith:prefix+'-'}},select:{admissionNumber:true}});
        let next=existing.reduce((max:number,row:any)=>{const suffix=row.admissionNumber.slice(prefix.length+1);return /^\d+$/.test(suffix)?Math.max(max,Number(suffix)):max;},0)+1;
        admissionNumber=prefix+'-'+String(next).padStart(6,'0');
      }
      const policy = await tx.schoolSetting.findUnique({ where: { schoolId } });
      let sectionId=requestedSectionId;
      if(!sectionId && policy?.sectionCapacityPolicy?.autoAssignOnJoin){
        const sections=await tx.section.findMany({where:{schoolId,classId,status:'ACTIVE'},orderBy:{id:'asc'}});
        // Stable locks serialize automatic and manual reservations before occupancy reads.
        for(const section of sections)await tx.section.update({where:{id:section.id},data:{updatedAt:new Date()}});
        const counts=await tx.studentEnrollment.groupBy({by:['sectionId'],where:{schoolId,academicYearId,classId,status:'ACTIVE'},_count:{_all:true}});
        const limits=sections.map((s:any)=>({id:s.id,capacity:effectiveCapacity(policy.sectionCapacityPolicy,schoolClass,s).capacity,occupied:counts.find((c:any)=>c.sectionId===s.id)?._count._all || 0})).filter((s:any)=>s.capacity!==null && s.capacity>=s.occupied);
        const result=capacityAllocation([{id:'new-admission',version:1}],limits,policy.sectionCapacityPolicy,academicYearId);
        sectionId=result.assignments[0]?.sectionId;
      }
      if (policy?.admissionsPolicy?.requireSectionOnJoin && !sectionId) throw new BadRequestException('This school requires a section at joining.');
      if (sectionId) { const current = await tx.section.findFirst({ where: { id: sectionId, schoolId, classId, status: 'ACTIVE' } }); if (!current) throw new BadRequestException('Choose an active section with configured capacity.'); await tx.section.update({where:{id:current.id},data:{capacity:current.capacity}}); const occupied = await tx.studentEnrollment.count({ where: { schoolId, academicYearId, sectionId, status: 'ACTIVE' } }); const capacity=await seatCapacity(tx,schoolId,academicYearId,classId,current); if (capacity===null || occupied >= capacity) throw new ConflictException('Section is full.'); }

      const rollNumber=await assignSectionRoll(tx,schoolId,academicYearId,sectionId,data.enrollment.rollNumber);
      const studentUser = await tx.user.create({ data: { schoolId: null, username: `student-${schoolId}-${admissionNumber}-${randomBytes(3).toString('hex')}`, email: `student-${schoolId}-${admissionNumber}-${randomBytes(4).toString('hex')}@internal.davi.local`, passwordHash, firstName: this.required(data.student.firstName, 'student.firstName'), lastName: data.student.lastName?.trim() || '', mustChangePassword: false } });
      const student = await tx.student.create({ data: { userId: studentUser.id, studentCode: `STU-${randomBytes(8).toString('hex')}`, birthDate: data.student.dateOfBirth ? new Date(data.student.dateOfBirth) : null, gender: data.student.gender } });
      const enrollment = await tx.studentEnrollment.create({ data: { schoolId, studentId: student.id, academicYearId, classId, sectionId, admissionNumber, address:data.enrollment.address?.trim() || null, admissionDate:data.enrollment.admissionDate?new Date(data.enrollment.admissionDate):null, rollNumber }, include: { school: true, academicYear: true, schoolClass: true, section: true } });
      if(policy?.sectionCapacityPolicy?.autoAssignOnJoin && !sectionId)await tx.auditLog.create({data:{schoolId,actorId,method:'POST',path:'/admissions/joining',action:'STUDENT_PLACEMENT_WAITLISTED',entityType:'StudentEnrollment',entityId:enrollment.id,metadata:{academicYearId,classId,reason:'No configured section has available capacity.'}}});
      if(sectionId)await tx.auditLog.create({data:{schoolId,actorId,method:'POST',path:'/admissions/joining',action:'STUDENT_SECTION_ASSIGNED',entityType:'StudentEnrollment',entityId:enrollment.id,metadata:{academicYearId,classId,sectionId,source:requestedSectionId?'MANUAL':'AUTOMATIC'}}});
      const linkedParents = [];
      for (const input of parentInputs) {
        let user = await tx.user.findFirst({ where: { schoolId: null, OR: [{ username: input.mobile }, { phone: input.mobile }] }, include: { parent: true } }); const existed = Boolean(user);
        if(migration && user){
          const membership=user.parent && await tx.parentSchoolMembership.findUnique({where:{parentId_schoolId:{parentId:user.parent.id,schoolId}}});
          if(user.status!=='ACTIVE' || !user.parent || !migration.verifiedParentIds.includes(user.parent.id) || membership?.verificationStatus!=='VERIFIED' || membership?.status!=='ACTIVE')throw new ForbiddenException('Existing parent accounts require an explicitly selected verified parent ID. Mobile number alone cannot link a parent during migration.');
        }
        if(migration?.verifiedParentIds.length && !user)throw new BadRequestException('The selected verified parent does not match this mobile.');
        if (!user) user = await tx.user.create({ data: { schoolId: null, username: input.mobile, email: input.email?.trim().toLowerCase() || `${input.mobile}@login.davi.local`, passwordHash, firstName: this.required(input.firstName, 'parent.firstName'), lastName: input.lastName?.trim() || '', phone: input.mobile, mustChangePassword: true }, include: { parent: true } });
        const parent = user.parent ?? await tx.parent.create({ data: { userId: user.id } });
        let membership = await tx.parentSchoolMembership.findUnique({ where: { parentId_schoolId: { parentId: parent.id, schoolId } } });
        if (!membership) membership = await tx.parentSchoolMembership.create({ data: { parentId: parent.id, schoolId, parentCode: await this.uniqueParentCode(tx, schoolId, input.mobile), verificationStatus: existed ? 'PENDING' : 'VERIFIED', verifiedAt: existed ? null : new Date() } });
        let role = await tx.role.findFirst({ where: { schoolId, code: 'PARENT' } }); if (!role) role = await tx.role.create({ data: { schoolId, name: 'Parent', code: 'PARENT', description: 'Parent portal access' } });
        await tx.userRole.upsert({ where: { userId_roleId: { userId: user.id, roleId: role.id } }, update: { schoolId }, create: { userId: user.id, roleId: role.id, schoolId } });
        const link = await tx.studentParent.create({ data: { studentId: student.id, parentId: parent.id, relationshipType: input.relationship?.trim().toUpperCase() || 'GUARDIAN', isPrimary: input.isPrimary, status: membership.verificationStatus === 'VERIFIED' ? 'ACTIVE' : 'PENDING' } });
        linkedParents.push({ id: parent.id, firstName: user.firstName, lastName: user.lastName, relationship: link.relationshipType, isPrimary: link.isPrimary, verificationRequired: membership.verificationStatus !== 'VERIFIED' });
      }
      return { student: { ...student, user: { id: studentUser.id, firstName: studentUser.firstName, lastName: studentUser.lastName } }, enrollment, class: schoolClass, section, parents: linkedParents, primaryParent: linkedParents.find((parent) => parent.isPrimary) };
    };
    return transaction ? execute(transaction) : admissionsTransaction(this.prisma, execute);
  }
  private async uniqueParentCode(tx: any, schoolId: string, mobile: string) { const base = `P-${mobile}`; if (!await tx.parentSchoolMembership.findFirst({ where: { schoolId, parentCode: base } })) return base; return `${base}-${randomBytes(2).toString('hex').toUpperCase()}`; }
  private required(value: string | undefined, field: string) { if (!value?.trim()) throw new BadRequestException(`${field} is required.`); return value.trim(); }
  private mobile(value: string) { const digits = value.replace(/\D/g, ''); const normalized = digits.startsWith('91') && digits.length === 12 ? digits.slice(2) : digits; if (!/^[6-9]\d{9}$/.test(normalized)) throw new BadRequestException('mobile must be a valid 10-digit Indian mobile number.'); return normalized; }
}
