require('reflect-metadata');
const test = require('node:test');
const assert = require('node:assert/strict');
const { ConflictException, ForbiddenException } = require('@nestjs/common');
const { SubjectsService } = require('../dist/subjects/subjects.service');
const { AcademicYearsService } = require('../dist/academic-years/academic-years.service');

const school = { id: 'school-1' };
const otherSchool = { id: 'school-2' };
const subject = { id: 'subject-1', schoolId: school.id, name: 'Mathematics', code: 'MATH', type: 'CORE', status: 'ACTIVE' };
const year = { id: 'year-1', schoolId: school.id, name: '2026-2027' };

function subjectPrisma(overrides = {}) {
  return {
    school: { findUnique: async () => school },
    subject: {
      findUnique: async () => subject, findFirst: async () => null,
      findMany: async () => [subject], create: async ({ data }) => ({ id: subject.id, ...data }),
      update: async ({ data }) => ({ ...subject, ...data }), delete: async () => subject,
    },
    academicYearSubject: { count: async () => 0 },
    ...overrides,
  };
}

test('creates a valid subject and permits the same name/code in another school', async () => {
  const service = new SubjectsService(subjectPrisma());
  const created = await service.create(school.id, { schoolId: school.id, name: ' Mathematics ', code: 'math' });
  assert.equal(created.code, 'MATH');
  const second = await service.create(otherSchool.id, { schoolId: otherSchool.id, name: 'Mathematics', code: 'MATH' });
  assert.equal(second.schoolId, otherSchool.id);
});

test('rejects a duplicate subject code within a school', async () => {
  const prisma = subjectPrisma();
  prisma.subject.findFirst = async () => subject;
  await assert.rejects(() => new SubjectsService(prisma).create(school.id, { schoolId: school.id, name: 'Maths', code: 'MATH' }), ConflictException);
});

test('updates a subject and blocks deletion while assigned', async () => {
  const prisma = subjectPrisma();
  const service = new SubjectsService(prisma);
  assert.equal((await service.update(subject.id, school.id, { name: 'Advanced Mathematics' })).name, 'Advanced Mathematics');
  prisma.academicYearSubject.count = async () => 1;
  await assert.rejects(() => service.remove(subject.id, school.id), ConflictException);
});

test('deletes an unassigned subject', async () => {
  const service = new SubjectsService(subjectPrisma());
  assert.equal((await service.remove(subject.id, school.id)).id, subject.id);
});

function academicPrisma(overrides = {}) {
  const prisma = {
    academicYear: { findUnique: async () => year },
    subject: { findMany: async () => [subject] },
    academicYearSubject: { findMany: async () => [], findUnique: async () => ({ academicYearId: year.id, subjectId: subject.id }), delete: async () => ({}) },
    $transaction: async (callback) => callback({
      academicYearSubject: { createMany: async () => ({ count: 1 }) },
      subject: { findMany: async () => [subject] },
    }),
    ...overrides,
  };
  return prisma;
}

test('assigns, lists, and removes an academic-year subject without deleting its master', async () => {
  const prisma = academicPrisma();
  const service = new AcademicYearsService(prisma);
  assert.deepEqual(await service.assignSubjects(year.id, school.id, { schoolId: school.id, subjectIds: [subject.id] }), [subject]);
  prisma.academicYearSubject.findMany = async () => [{ subject }];
  const listed = await service.findSubjects(year.id, school.id);
  assert.deepEqual(listed.subjects, [subject]);
  const removed = await service.removeSubject(year.id, subject.id, school.id);
  assert.equal(removed.subjectId, subject.id);
  assert.equal(typeof prisma.subject.delete, 'undefined');
});

test('rejects duplicate assignment and cross-school subject/year access', async () => {
  const duplicatePrisma = academicPrisma();
  duplicatePrisma.academicYearSubject.findMany = async () => [{ subjectId: subject.id }];
  await assert.rejects(() => new AcademicYearsService(duplicatePrisma).assignSubjects(year.id, school.id, { schoolId: school.id, subjectIds: [subject.id] }), ConflictException);

  const subjectPrisma = academicPrisma();
  subjectPrisma.subject.findMany = async () => [{ ...subject, schoolId: otherSchool.id }];
  await assert.rejects(() => new AcademicYearsService(subjectPrisma).assignSubjects(year.id, school.id, { schoolId: school.id, subjectIds: [subject.id] }), ForbiddenException);

  const yearPrisma = academicPrisma();
  yearPrisma.academicYear.findUnique = async () => ({ ...year, schoolId: otherSchool.id });
  await assert.rejects(() => new AcademicYearsService(yearPrisma).assignSubjects(year.id, school.id, { schoolId: school.id, subjectIds: [subject.id] }), ForbiddenException);
});
