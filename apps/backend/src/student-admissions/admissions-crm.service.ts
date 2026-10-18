import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { z } from 'zod';
import { PrismaService } from '../prisma/prisma.service';
import { StudentAdmissionsService } from './student-admissions.service';
import { admissionsTransaction } from './admissions-transaction';
import { applicationSchema, checkVersion, defaultAdmissionSettings, enquirySchema, followupSchema, id, instant, parse, reason, settingsSchema, text } from './admissions-rules';

const contactName = (value: string) => value.trim().replace(/\s+/g, ' ');
const number = (prefix: string) => `${prefix}-${randomUUID().replace(/-/g, '').slice(0,16).toUpperCase()}`;
const documentSelect = { id: true, name: true, kind: true, mimeType: true, size: true, createdAt: true };

@Injectable()
export class AdmissionsCrmService {
  constructor(private readonly db: PrismaService, private readonly admissions: StudentAdmissionsService) {}
  async legacyJoin(schoolId: string | null, actorId: string, data: any) {
    const application = await this.createApplication(schoolId, actorId, { academicYearId: data.enrollment?.academicYearId, classId: data.enrollment?.classId, sectionId: data.enrollment?.sectionId || null, student: { firstName: data.student?.firstName, lastName: data.student?.lastName || '', ...(data.student?.dateOfBirth ? { dateOfBirth: data.student.dateOfBirth } : {}), ...(data.student?.gender ? { gender: data.student.gender } : {}) }, parents: data.parents });
    const approved = await this.decision(schoolId, actorId, application.id, { version: application.version, decision: 'APPROVED', reason: 'Authorized direct admission and joining request.' });
    const joined = await this.join(schoolId, actorId, application.id, { version: approved.version, status: 'JOINED', admissionNumber: data.student?.admissionNumber, joinedAt: new Date().toISOString().slice(0,10), sectionId: data.enrollment?.sectionId || null, reason: 'Authorized direct admission and joining request.' });
    const enrollment = await this.db.studentEnrollment.findUnique({ where: { id: joined.enrollmentId }, include: { student: { include: { user: { select: { id: true, firstName: true, lastName: true } } } }, schoolClass: true, section: true } });
    return { application: joined, enrollment, student: enrollment?.student, class: enrollment?.schoolClass, section: enrollment?.section };
  }
  school(schoolId: string | null): asserts schoolId is string { if (!schoolId) throw new ForbiddenException('A school account is required.'); }
  async scope(db: any, schoolId: string, academicYearId: string, classId?: string, sectionId?: string | null) {
    if (!await db.academicYear.findFirst({ where: { id: academicYearId, schoolId } })) throw new BadRequestException('Academic year does not belong to this school.');
    if (classId && !await db.schoolClass.findFirst({ where: { id: classId, academicYearId, schoolId, status: 'ACTIVE' } })) throw new BadRequestException('Choose an active class in this school and academic year.');
    if (sectionId && !await db.section.findFirst({ where: { id: sectionId, classId, schoolId, status: 'ACTIVE' } })) throw new BadRequestException('Choose an active section of the selected class.');
  }
  async staff(db: any, schoolId: string, staffId?: string | null) { if (staffId && !await db.staff.findFirst({ where: { id: staffId, schoolId, status: 'ACTIVE' } })) throw new BadRequestException('Assigned staff must be active in this school.'); }
  async activity(db: any, schoolId: string, actorId: string, kind: string, details: any, target: { enquiryId?: string; applicationId?: string }) { return db.admissionActivity.create({ data: { schoolId, actorId, kind, details, ...target } }); }
  async settings(schoolId: string | null, db: any = this.db): Promise<any> { this.school(schoolId); const row = await db.schoolSetting.findUnique({ where: { schoolId } }); return { ...defaultAdmissionSettings, ...(row?.admissionsPolicy || {}) }; }
  async saveSettings(schoolId: string | null, actorId: string, body: unknown) {
    this.school(schoolId); const data = parse(settingsSchema, body);
    return admissionsTransaction(this.db, async tx => {
      for (const fee of data.fees) for (const classId of fee.classIds) await this.scope(tx, schoolId, fee.academicYearId, classId);
      const before = await this.settings(schoolId, tx);
      await tx.schoolSetting.upsert({ where: { schoolId }, create: { schoolId, admissionsPolicy: data }, update: { admissionsPolicy: data } });
      await this.activity(tx, schoolId, actorId, 'SETTINGS_CHANGED', { before, after: data }, {}); return data;
    });
  }
  async lookups(schoolId: string | null) {
    this.school(schoolId);
    const [school, years, classes, staff, settings] = await Promise.all([
      this.db.school.findUnique({ where: { id: schoolId }, select: { name: true, shortName: true } }),
      this.db.academicYear.findMany({ where: { schoolId }, orderBy: { createdAt: 'desc' } }),
      this.db.schoolClass.findMany({ where: { schoolId }, include: { sections: true }, orderBy: { createdAt: 'asc' } }),
      this.db.staff.findMany({ where: { schoolId, status: 'ACTIVE' }, select: { id: true, user: { select: { firstName: true, lastName: true } } } }), this.settings(schoolId),
    ]); return { school, years, classes, staff, settings };
  }
  async list(schoolId: string | null, kind: 'enquiries' | 'applications', query: any) {
    this.school(schoolId);
    const q = parse(z.object({ academicYearId: id.optional(), classId: id.optional(), status: text.optional(), joiningStatus: text.optional(), search: z.string().max(200).optional(), due: z.enum(['pending','overdue']).optional(), page: z.coerce.number().int().min(1).max(100000).default(1), pageSize: z.coerce.number().int().min(1).max(100).default(25) }).strict(), query);
    const where: any = { schoolId, ...(q.academicYearId ? { academicYearId: q.academicYearId } : {}), ...(q.classId ? { classId: q.classId } : {}) };
    if (q.status) where[kind === 'enquiries' ? 'status' : 'decision'] = q.status;
    if (q.joiningStatus && kind === 'applications') where.joiningStatus = q.joiningStatus;
    if (q.search) where.OR = ['number','studentName','mobile'].map(field => ({ [field]: { contains: q.search, mode: 'insensitive' } }));
    if (q.due && kind === 'enquiries') { where.AND = [{status:{ notIn: ['CONVERTED','CLOSED','NOT_INTERESTED'] }}]; where.nextFollowUpAt = q.due === 'overdue' ? { lt: new Date() } : { not: null }; }
    const model = kind === 'enquiries' ? this.db.admissionEnquiry : this.db.admissionApplication;
    const [rows, total] = await Promise.all([(model as any).findMany({ where, orderBy: q.due ? [{ nextFollowUpAt: 'asc' }, { id: 'asc' }] : [{ createdAt: 'desc' }, { id: 'asc' }], skip: (q.page - 1) * q.pageSize, take: q.pageSize }), (model as any).count({ where })]);
    return { rows, total, page: q.page, pageSize: q.pageSize };
  }
  async enquiry(schoolId: string, enquiryId: string, db: any = this.db) { const row = await db.admissionEnquiry.findFirst({ where: { id: enquiryId, schoolId }, include: { activities: { orderBy: { createdAt: 'desc' } }, applications: { select: { id: true, number: true, decision: true, joiningStatus: true } } } }); if (!row) throw new NotFoundException('Enquiry not found.'); return row; }
  async application(schoolId: string, applicationId: string, db: any = this.db) { const row = await db.admissionApplication.findFirst({ where: { id: applicationId, schoolId }, include: { payments: { orderBy: { createdAt: 'desc' } }, activities: { orderBy: { createdAt: 'desc' } }, documents: { select: documentSelect }, enrollment: true } }); if (!row) throw new NotFoundException('Application not found.'); return row; }
  async detail(schoolId: string | null, kind: 'enquiries' | 'applications', recordId: string) { this.school(schoolId); return kind === 'enquiries' ? this.enquiry(schoolId, recordId) : this.application(schoolId, recordId); }
  async createEnquiry(schoolId: string | null, actorId: string, body: unknown) {
    this.school(schoolId); const input = parse(enquirySchema, body); const data = { ...input, studentName: contactName(input.studentName) };
    return admissionsTransaction(this.db, async tx => {
      await this.scope(tx, schoolId, data.academicYearId, data.classId); await this.staff(tx, schoolId, data.assignedStaffId);
      const existing = await tx.admissionEnquiry.findFirst({ where: { schoolId, academicYearId: data.academicYearId, classId: data.classId, mobile: data.mobile, studentName: { equals: data.studentName, mode: 'insensitive' } } });
      if (existing) { await this.activity(tx, schoolId, actorId, 'REPEAT_ENQUIRY', data, { enquiryId: existing.id }); return { ...existing, duplicate: true }; }
      const row = await tx.admissionEnquiry.create({ data: { ...data, email: data.email || null, schoolId, number: number('ENQ'), enquiryDate: data.enquiryDate ? new Date(data.enquiryDate) : new Date(), nextFollowUpAt: data.nextFollowUpAt ? new Date(data.nextFollowUpAt) : null } });
      await this.activity(tx, schoolId, actorId, 'ENQUIRY_CREATED', data, { enquiryId: row.id }); return row;
    });
  }
  async followup(schoolId: string | null, actorId: string, enquiryId: string, body: unknown) {
    this.school(schoolId); const data = parse(followupSchema, body);
    if (new Date(data.occurredAt) > new Date()) throw new BadRequestException('An interaction cannot be recorded in the future.');
    if (data.nextFollowUpAt && new Date(data.nextFollowUpAt) <= new Date(data.occurredAt)) throw new BadRequestException('The next follow-up must be after this interaction.');
    return admissionsTransaction(this.db, async tx => {
      const before = await this.enquiry(schoolId, enquiryId, tx); checkVersion(before.version, data.version);
      if (before.status === 'CONVERTED' || ['APPLICATION_STARTED','CONVERTED'].includes(data.status)) throw new BadRequestException('Application and conversion status is controlled by the admission workflow.');
      if (data.status === 'FOLLOW_UP_REQUIRED' && !data.nextFollowUpAt) throw new BadRequestException('Schedule the next follow-up.');
      await this.staff(tx, schoolId, data.assignedStaffId);
      const row = await tx.admissionEnquiry.update({ where: { id: enquiryId }, data: { status: data.status, assignedStaffId: data.assignedStaffId, nextFollowUpAt: data.nextFollowUpAt ? new Date(data.nextFollowUpAt) : null, version: { increment: 1 } } });
      await this.activity(tx, schoolId, actorId, 'FOLLOW_UP', data, { enquiryId }); return row;
    });
  }
  async createApplication(schoolId: string | null, actorId: string, body: unknown) {
    this.school(schoolId); const data = parse(applicationSchema, body);
    return admissionsTransaction(this.db, async tx => {
      await this.scope(tx, schoolId, data.academicYearId, data.classId, data.sectionId);
      const settings = await this.settings(schoolId, tx);
      for (const field of settings.extraFields) if (field.required && !data.extraFields[field.key]?.trim()) throw new BadRequestException(`${field.label} is required.`);
      if (Object.keys(data.extraFields).some(key => !settings.extraFields.some((field: any) => field.key === key))) throw new BadRequestException('The form configuration changed. Reload before applying.');
      if (data.enquiryId) { const enquiry = await this.enquiry(schoolId, data.enquiryId, tx); if (enquiry.academicYearId !== data.academicYearId || enquiry.classId !== data.classId) throw new BadRequestException('Application must use the enquiry class and year.'); if (enquiry.status === 'CONVERTED') throw new ConflictException('Enquiry has already converted.'); }
      const primary = data.parents.find(parent => parent.isPrimary)!;
      const feePolicy = settings.fees.find((fee: any) => fee.academicYearId === data.academicYearId && fee.classIds.includes(data.classId)) || { amountMinor: 0, mandatory: false, methods: ['CASH','BANK_TRANSFER','UPI'], refundPolicy: 'No fee configured', waiverAllowed: false };
      const row = await tx.admissionApplication.create({ data: { schoolId, number: number('APP'), enquiryId: data.enquiryId, academicYearId: data.academicYearId, classId: data.classId, sectionId: data.sectionId || null, studentName: contactName(data.student.firstName + ' ' + data.student.lastName), mobile: primary.mobile, formData: data, feePolicy } });
      if (data.enquiryId) await tx.admissionEnquiry.update({ where: { id: data.enquiryId }, data: { status: 'APPLICATION_STARTED', version: { increment: 1 } } });
      await this.activity(tx, schoolId, actorId, 'APPLICATION_CREATED', { number: row.number }, { applicationId: row.id, enquiryId: data.enquiryId }); return row;
    });
  }
  async decision(schoolId: string | null, actorId: string, applicationId: string, body: unknown) {
    this.school(schoolId); const data = parse(z.object({ version: z.number().int().positive(), decision: z.enum(['UNDER_REVIEW','APPROVED','REJECTED','WAITLISTED','WITHDRAWN']), reason }).strict(), body);
    return admissionsTransaction(this.db, async tx => {
      const before = await this.application(schoolId, applicationId, tx); checkVersion(before.version, data.version);
      if (before.joiningStatus === 'JOINED') throw new BadRequestException('Use the enrollment withdrawal or transfer workflow for joined students.');
      const row = await tx.admissionApplication.update({ where: { id: applicationId }, data: { decision: data.decision, offerDate: data.decision === 'APPROVED' ? new Date() : before.offerDate, version: { increment: 1 } } });
      await this.activity(tx, schoolId, actorId, 'DECISION', { before: before.decision, ...data }, { applicationId }); return row;
    });
  }
  async amendApplication(schoolId: string | null, actorId: string, applicationId: string, body: unknown) {
    this.school(schoolId); const input = parse(z.object({ version: z.number().int().positive(), data: applicationSchema }).strict(), body);
    return admissionsTransaction(this.db, async tx => {
      const before = await this.application(schoolId, applicationId, tx); checkVersion(before.version,input.version);
      if (before.enrollmentId || before.decision === 'APPROVED' || before.decision === 'WITHDRAWN') throw new BadRequestException('Only unjoined applications under review, waitlisted or rejected may be amended.');
      const data = input.data;
      if (data.academicYearId !== before.academicYearId || data.classId !== before.classId || (data.enquiryId || null) !== before.enquiryId) throw new BadRequestException('An application amendment cannot change its class, year or originating enquiry.');
      await this.scope(tx,schoolId,data.academicYearId,data.classId,data.sectionId);
      const settings = await this.settings(schoolId,tx);
      for (const field of settings.extraFields) if (field.required && !data.extraFields[field.key]?.trim()) throw new BadRequestException(`${field.label} is required.`);
      const row = await tx.admissionApplication.update({where:{id:applicationId},data:{formData:data,studentName:contactName(data.student.firstName+' '+data.student.lastName),mobile:data.parents.find(parent=>parent.isPrimary)!.mobile,sectionId:data.sectionId||null,decision:'UNDER_REVIEW',version:{increment:1}}});
      await this.activity(tx,schoolId,actorId,'APPLICATION_AMENDED',{before:before.formData,after:data},{applicationId});return row;
    });
  }
  async join(schoolId: string | null, actorId: string, applicationId: string, body: unknown) {
    this.school(schoolId); const data = parse(z.object({ version: z.number().int().positive(), status: z.enum(['JOINED','NOT_JOINED']), admissionNumber: text.optional(), sectionId: id.nullable().optional(), joinedAt: z.string().date().optional(), reason }).strict(), body);
    return admissionsTransaction(this.db, async tx => {
      const before = await this.application(schoolId, applicationId, tx); checkVersion(before.version, data.version);
      if (before.enrollmentId) throw new ConflictException('Joining has already created an enrollment.');
      if (before.decision !== 'APPROVED') throw new BadRequestException('Only an approved application can enter the joining workflow.');
      let enrollmentId: string | undefined;
      if (data.status === 'JOINED') {
        if (!data.admissionNumber || !data.joinedAt) throw new BadRequestException('Admission number and actual joining date are required.');
        if (new Date(data.joinedAt) > new Date()) throw new BadRequestException('Actual joining date cannot be in the future.');
        const sectionId = data.sectionId === undefined ? before.sectionId : data.sectionId;
        const primary = before.formData.parents.find((parent: any) => parent.isPrimary);
        const existingStudent = await tx.student.findFirst({ where: { enrollments: { some: { schoolId } }, user: { firstName: { equals: before.formData.student.firstName, mode: 'insensitive' }, lastName: { equals: before.formData.student.lastName || '', mode: 'insensitive' } }, studentParents: { some: { parent: { user: { phone: primary.mobile } } } }, ...(before.formData.student.dateOfBirth ? { birthDate: new Date(before.formData.student.dateOfBirth) } : {}) } });
        if (existingStudent) throw new ConflictException('This student already has a profile in this school. Use Student Directory and Promotions rather than creating a duplicate.');
        const settings = await this.settings(schoolId, tx);
        if (settings.requireSectionOnJoin && !sectionId) throw new BadRequestException('This school requires a section at joining.');
        for (const kind of settings.requiredDocuments) if (!before.documents.some((document: any) => document.kind === kind)) throw new BadRequestException(`Upload ${kind} before joining.`);
        const paid = before.payments.filter((payment: any) => ['VERIFIED','WAIVED'].includes(payment.status)).reduce((total: number, payment: any) => total + payment.amountMinor, 0);
        if (before.feePolicy.mandatory && paid < before.feePolicy.amountMinor) throw new BadRequestException('Verify the mandatory application fee or an eligible waiver before joining.');
        const result = await this.admissions.create(schoolId, { student: { ...before.formData.student, admissionNumber: data.admissionNumber }, enrollment: { academicYearId: before.academicYearId, classId: before.classId, sectionId: sectionId || undefined }, parents: before.formData.parents }, tx);
        enrollmentId = result.enrollment.id;
      }
      const row = await tx.admissionApplication.update({ where: { id: applicationId }, data: { joiningStatus: data.status, joiningConfirmedAt: new Date(), joinedAt: data.status === 'JOINED' ? new Date(data.joinedAt!) : null, notJoinedReason: data.status === 'NOT_JOINED' ? data.reason : null, enrollmentId, sectionId: data.sectionId === undefined ? before.sectionId : data.sectionId, version: { increment: 1 } } });
      if (before.enquiryId && data.status === 'JOINED') await tx.admissionEnquiry.update({ where: { id: before.enquiryId }, data: { status: 'CONVERTED', nextFollowUpAt: null, version: { increment: 1 } } });
      await this.activity(tx, schoolId, actorId, 'JOINING', data, { applicationId, enquiryId: before.enquiryId || undefined }); return row;
    });
  }
  async recordPayment(schoolId: string | null, actorId: string, applicationId: string, body: unknown) {
    this.school(schoolId); const data = parse(z.object({ amountMinor: z.number().int().positive().max(100000000), method: z.enum(['CASH','BANK_TRANSFER','UPI']), reference: text }).strict(), body);
    return admissionsTransaction(this.db, async tx => {
      const application = await this.application(schoolId, applicationId, tx);
      if (!application.feePolicy.methods.includes(data.method)) throw new BadRequestException('This payment method is not enabled for the application.');
      const row = await tx.admissionPayment.create({ data: { ...data, schoolId, applicationId, recordedById: actorId } });
      await this.activity(tx, schoolId, actorId, 'PAYMENT_RECORDED', { paymentId: row.id, ...data }, { applicationId }); return row;
    });
  }
  async verifyPayment(schoolId: string | null, actorId: string, paymentId: string, body: unknown) {
    this.school(schoolId); const data = parse(z.object({ version: z.number().int().positive(), status: z.enum(['VERIFIED','REJECTED','REFUNDED']), reason }).strict(), body);
    return admissionsTransaction(this.db, async tx => {
      const before = await tx.admissionPayment.findFirst({ where: { id: paymentId, schoolId } }); if (!before) throw new NotFoundException('Payment not found.'); checkVersion(before.version, data.version);
      if (before.status !== (data.status === 'REFUNDED' ? 'VERIFIED' : 'PENDING')) throw new ConflictException('Payment cannot make this transition.');
      const row = await tx.admissionPayment.update({ where: { id: paymentId }, data: { status: data.status, verifiedById: data.status==='REFUNDED'?before.verifiedById:actorId, verifiedAt: data.status==='REFUNDED'?before.verifiedAt:new Date(), reason: data.reason, receiptNumber: data.status === 'VERIFIED' ? number('RCPT') : before.receiptNumber, version: { increment: 1 } } });
      await this.activity(tx, schoolId, actorId, 'PAYMENT_' + data.status, { paymentId, amountMinor: row.amountMinor, reason: data.reason }, { applicationId: row.applicationId }); return row;
    });
  }
  async waive(schoolId: string | null, actorId: string, applicationId: string, body: unknown) {
    this.school(schoolId); const data = parse(z.object({ version: z.number().int().positive(), reason }).strict(), body);
    return admissionsTransaction(this.db, async tx => {
      const application = await this.application(schoolId, applicationId, tx); checkVersion(application.version, data.version);
      if (!application.feePolicy.waiverAllowed) throw new BadRequestException('This application fee does not allow waivers.');
      const credited = application.payments.filter((p: any) => ['VERIFIED','WAIVED'].includes(p.status)).reduce((n: number,p: any) => n+p.amountMinor,0);
      const amountMinor = application.feePolicy.amountMinor - credited;
      if (amountMinor <= 0) throw new BadRequestException('No outstanding application fee to waive.');
      const row = await tx.admissionPayment.create({ data: { schoolId, applicationId, amountMinor, method: 'WAIVER', reference: 'WAIVER-' + applicationId, status: 'WAIVED', recordedById: actorId, verifiedById: actorId, verifiedAt: new Date(), reason: data.reason } });
      await tx.admissionApplication.update({ where: { id: applicationId }, data: { version: { increment: 1 } } });
      await this.activity(tx, schoolId, actorId, 'FEE_WAIVED', { ...data, amountMinor, eligibility: application.feePolicy.waiverEligibility }, { applicationId }); return row;
    });
  }
  async dashboard(schoolId: string | null, query: any) {
    this.school(schoolId); const filters = parse(z.object({ academicYearId: id, classId: id.optional() }).strict(), query); await this.scope(this.db, schoolId, filters.academicYearId, filters.classId);
    return admissionsTransaction(this.db, async tx => {
      const where = { schoolId, ...filters };
      const [enquiries, applications, due, fees, enrollmentCounts, unassigned] = await Promise.all([
        tx.admissionEnquiry.count({ where }), tx.admissionApplication.groupBy({ by: ['decision','joiningStatus'], where, _count: { _all: true } }),
        tx.admissionEnquiry.count({ where: { ...where, nextFollowUpAt: { lte: new Date() }, status: { notIn: ['CONVERTED','CLOSED','NOT_INTERESTED'] } } }),
        tx.admissionPayment.aggregate({ where: { schoolId, status: 'VERIFIED', application: where }, _sum: { amountMinor: true } }),
        tx.studentEnrollment.groupBy({ by: ['classId'], where: { ...where, status: 'ACTIVE' }, _count: { _all: true } }),
        tx.studentEnrollment.count({ where: { ...where, status: 'ACTIVE', sectionId: null } }),
      ]);
      const count = (key: string, value: string) => applications.filter((row: any) => row[key] === value).reduce((sum: number,row: any) => sum+row._count._all,0);
      return { enquiries, followupsDue: due, applications: applications.reduce((sum: number,row: any) => sum+row._count._all,0), applicationFeesCollectedMinor: fees._sum.amountMinor || 0, approved: count('decision','APPROVED'), joined: count('joiningStatus','JOINED'), notJoined: count('joiningStatus','NOT_JOINED'), waitlisted: count('decision','WAITLISTED'), enrollmentCounts, unassigned };
    });
  }
}
