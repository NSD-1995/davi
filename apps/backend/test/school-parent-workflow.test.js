require('reflect-metadata');
const test = require('node:test');
const assert = require('node:assert/strict');
const { BadRequestException, ConflictException, ForbiddenException } = require('@nestjs/common');
const { ParentsService } = require('../dist/parents/parents.service');
const { SchoolsService } = require('../dist/schools/schools.service');

const schoolId = 'school-1';
const parent = { id: 'parent-1', userId: 'user-1', user: { id: 'user-1', firstName: 'Asha', lastName: 'Patel', phone: '9876543210' }, memberships: [], studentParents: [] };
const membership = { id: 'membership-1', parentId: parent.id, schoolId, parentCode: 'P001', status: 'ACTIVE', verificationStatus: 'VERIFIED', parent };

test('current-school profile ignores fields that a school admin may not change', async () => {
  let update;
  const prisma = { school: { findUnique: async () => ({ id: schoolId, name: 'Old School' }), update: async (args) => { update = args; return { id: schoolId, ...args.data }; } } };
  const result = await new SchoolsService(prisma).updateCurrent(schoolId, { name: ' New School ', shortName: 'HACK', adminEmail: 'other@example.com', state: 'Gujarat' });
  assert.equal(result.name, 'New School'); assert.equal(result.state, 'Gujarat');
  assert.equal(update.where.id, schoolId); assert.equal('shortName' in update.data, false); assert.equal('adminEmail' in update.data, false);
});

test('school profile rejects missing tenant and blank school name', async () => {
  const service = new SchoolsService({ school: {} });
  await assert.rejects(() => service.findCurrent(null), ForbiddenException);
  await assert.rejects(() => service.updateCurrent(schoolId, { name: '   ' }), BadRequestException);
});

function parentPrisma(overrides = {}) {
  return {
    parent: { findUnique: async () => parent },
    parentSchoolMembership: { findUnique: async () => membership },
    studentEnrollment: { findFirst: async () => ({ id: 'enrollment-1', studentId: 'student-1', schoolId }) },
    studentParent: { findUnique: async () => null },
    ...overrides,
  };
}

test('parent access and student linking reject cross-school records', async () => {
  const prisma = parentPrisma({ parentSchoolMembership: { findUnique: async () => null } });
  await assert.rejects(() => new ParentsService(prisma).findOne(parent.id, schoolId), ForbiddenException);
  const missingStudent = parentPrisma({ studentEnrollment: { findFirst: async () => null } });
  await assert.rejects(() => new ParentsService(missingStudent).linkStudent(parent.id, schoolId, { studentId: 'other-school-student' }), /not actively enrolled in your school/);
});

test('duplicate parent-student link is rejected', async () => {
  const prisma = parentPrisma({ studentParent: { findUnique: async () => ({ id: 'link-1' }) } });
  await assert.rejects(() => new ParentsService(prisma).linkStudent(parent.id, schoolId, { studentId: 'student-1', relationshipType: 'mother' }), ConflictException);
});

test('parent update validates mobile and reports duplicate login', async () => {
  const invalid = parentPrisma({ user: { findFirst: async () => null } });
  await assert.rejects(() => new ParentsService(invalid).update(parent.id, schoolId, { mobile: '123' }), BadRequestException);
  const duplicate = parentPrisma({ user: { findFirst: async () => ({ id: 'other-user' }) } });
  await assert.rejects(() => new ParentsService(duplicate).update(parent.id, schoolId, { mobile: '9876543211' }), ConflictException);
});

test('backend persistence failures are propagated to the caller', async () => {
  const failure = new Error('database unavailable');
  const prisma = { school: { findUnique: async () => ({ id: schoolId }), update: async () => { throw failure; } } };
  await assert.rejects(() => new SchoolsService(prisma).updateCurrent(schoolId, { city: 'Surat' }), failure);
});

test('school parent view never exposes a child enrollment from another school', async () => {
  const scopedParent = { ...parent, studentParents: [{ studentId: 'student-1', status: 'ACTIVE', student: { id: 'student-1', enrollments: [{ id: 'a', schoolId }, { id: 'b', schoolId: 'school-2' }] } }] };
  const prisma = { parentSchoolMembership: { findUnique: async () => ({ ...membership, parent: scopedParent }) } };
  const result = await new ParentsService(prisma).findOne(parent.id, schoolId);
  assert.deepEqual(result.studentParents[0].student.enrollments.map((row) => row.schoolId), [schoolId]);
});

test('parent children query is global and returns active relationships across schools', async () => {
  let query;
  const prisma = { parent: { findUnique: async () => parent }, studentParent: { findMany: async (args) => { query = args; return [{ studentId: 'student-a' }, { studentId: 'student-b' }]; } } };
  const result = await new ParentsService(prisma).findMyStudents(parent.userId);
  assert.equal(result.length, 2); assert.equal(query.where.parentId, parent.id); assert.equal(query.where.status, 'ACTIVE'); assert.equal(query.where.canViewAcademics, true);
  assert.equal(query.include.student.include.enrollments.where.status, 'ACTIVE');
});

test('parent enrollment dashboard rejects an enrollment outside active relationships', async () => {
  const prisma = { parent: { findUnique: async () => parent }, studentEnrollment: { findFirst: async () => null } };
  await assert.rejects(() => new ParentsService(prisma).enrollmentDashboard(parent.userId, 'other-enrollment'), ForbiddenException);
});
