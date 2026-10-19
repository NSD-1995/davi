import { BadRequestException, ConflictException } from '@nestjs/common';
import { z } from 'zod';

export const id = z.string().trim().min(1).max(100);
export const text = z.string().trim().min(1).max(200);
export const reason = z.string().trim().min(3).max(2000);
export const instant = z.string().datetime({ offset: true });
export const mobile = z.string().transform(value => value.replace(/\D/g, '').replace(/^91(?=\d{10}$)/, '')).pipe(z.string().regex(/^[6-9]\d{9}$/, 'Enter a valid mobile number.'));
export const enquiryStatuses = ['NEW', 'CONTACTED', 'INTERESTED', 'NOT_INTERESTED', 'FOLLOW_UP_REQUIRED', 'APPLICATION_STARTED', 'CONVERTED', 'CLOSED'] as const;
export const enquirySchema = z.object({ studentName: text, parentName: text, mobile, email: z.string().email().or(z.literal('')).optional(), academicYearId: id, classId: id, source: z.enum(['WALK_IN','PHONE','WEBSITE','REFERRAL','CAMPAIGN','OTHER']), assignedStaffId: id.nullable().optional(), enquiryDate: instant.optional(), nextFollowUpAt: instant.nullable().optional(), remarks: z.string().max(2000).optional() }).strict();
export const followupSchema = z.object({ version: z.number().int().positive(), occurredAt: instant, method: z.enum(['PHONE','VISIT','MESSAGE']), remarks: reason, outcome: text, status: z.enum(enquiryStatuses), nextFollowUpAt: instant.nullable(), assignedStaffId: id.nullable() }).strict();
export const parentSchema = z.object({ firstName: text, lastName: z.string().trim().max(200).default(''), mobile, email: z.string().email().or(z.literal('')).optional(), relationship: text.default('GUARDIAN'), isPrimary: z.boolean() });
export const applicationSchema = z.object({ enquiryId: id.optional(), academicYearId: id, classId: id, sectionId: id.nullable().optional(), student: z.object({ admissionNumber:z.string().trim().max(200).optional(),address:z.string().max(2000).optional(),firstName: text, lastName: z.string().trim().max(200).default(''), dateOfBirth: z.string().date().optional(), gender: z.enum(['MALE','FEMALE','OTHER']).optional() }).strict(), parents: z.array(parentSchema).min(1).max(2), previousSchool: z.string().max(300).optional(), extraFields: z.record(z.string().max(2000)).default({}) }).strict().refine(value => value.parents.filter(parent => parent.isPrimary).length === 1, 'Choose exactly one primary guardian.');
export const feeRule = z.object({ academicYearId: id, classIds: z.array(id).min(1).max(200), amountMinor: z.number().int().min(0).max(100000000), mandatory: z.boolean(), methods: z.array(z.enum(['CASH','BANK_TRANSFER','UPI'])).min(1), refundPolicy: reason, waiverAllowed: z.boolean(), waiverEligibility: z.string().max(2000).default('') }).strict();
export const settingsSchema = z.object({ requireSectionOnJoin: z.boolean(), formTitle: text, formDescription: z.string().max(2000), extraFields: z.array(z.object({ key: z.string().regex(/^[a-z][a-zA-Z0-9_]{0,40}$/), label: text, required: z.boolean() }).strict()).max(30), requiredDocuments: z.array(text).max(20), fees: z.array(feeRule).max(100) }).strict().superRefine((value, ctx) => {
  const seen = new Set<string>();
  for (const fee of value.fees) for (const classId of fee.classIds) { const key = fee.academicYearId + ':' + classId; if (seen.has(key)) ctx.addIssue({ code: 'custom', message: 'Each class/year can have only one application fee rule.' }); seen.add(key); }
  if (new Set(value.extraFields.map(field => field.key)).size !== value.extraFields.length) ctx.addIssue({ code: 'custom', message: 'Extra form field keys must be unique.' });
});
export const defaultAdmissionSettings = { requireSectionOnJoin: false, formTitle: 'Admission application', formDescription: '', extraFields: [], requiredDocuments: [], fees: [] };
export function parse<S extends z.ZodTypeAny>(schema: S, input: unknown): z.output<S> { const result = schema.safeParse(input); if (!result.success) throw new BadRequestException(result.error.issues.map(issue => issue.message).join(' ')); return result.data; }
export function checkVersion(actual: number, expected: number) { if (actual !== expected) throw new ConflictException('This record changed. Refresh and try again.'); }

/** Only unassigned enrollments are proposed. Existing section occupants remain fixed. */
export function balancedAllocation(students: Array<{ id: string; version: number }>, sections: Array<{ id: string; capacity: number | null; occupied: number }>) {
  const planned = sections.map(section => ({ ...section, count: section.occupied }));
  if (planned.some(section => section.capacity === null || section.capacity < section.occupied)) throw new BadRequestException('Configure a capacity at least equal to current enrollment for every selected section.');
  const assignments: Array<{ enrollmentId: string; version: number; sectionId: string }> = [];
  for (const student of students) {
    const target = planned.filter(section => section.count < section.capacity!).sort((a,b) => a.count - b.count || a.id.localeCompare(b.id))[0];
    if (!target) throw new BadRequestException('Insufficient section capacity. Add or increase confirmed sections before allocating.');
    assignments.push({ enrollmentId: student.id, version: student.version, sectionId: target.id }); target.count++;
  }
  return { assignments, distribution: planned.map(({ id, capacity, occupied, count }) => ({ sectionId: id, capacity, previouslyAssigned: occupied, proposedTotal: count })) };
}
