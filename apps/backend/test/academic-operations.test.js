require('reflect-metadata');
const test = require('node:test');
const assert = require('node:assert/strict');
const { BadRequestException, ConflictException, ForbiddenException } = require('@nestjs/common');
const { StudentsService } = require('../dist/students/students.service');
const { AttendanceService } = require('../dist/attendance/attendance.service');
const { TimetableService } = require('../dist/timetable/timetable.service');
const { ExamsService } = require('../dist/exams/exams.service');
const { EventsService } = require('../dist/events/events.service');

const schoolId = 'school-1';
test('existing enrollment endpoint delegates to the guarded promotion workflow', async () => {
  const previous = { id:'prior', version:2, admissionNumber:'ADM-1' };
  let promoted = false;
  const prisma = { student: { findFirst: async () => ({id:'student-1',user:{},enrollments:[{schoolId}],studentParents:[]}) }, studentEnrollment:{ findUnique:async()=>promoted?{id:'new',schoolId}:null,findFirst:async()=>previous } };
  const allocation = { promote:async(school,actor,data)=>{assert.equal(school,schoolId);assert.equal(actor,'admin');assert.deepEqual(data.enrollmentIds,[{id:'prior',version:2}]);assert.equal(data.sectionId,null);promoted=true;} };
  const enrollment = await new StudentsService(prisma,allocation).enroll('student-1',schoolId,{academicYearId:'new-year',classId:'class-1'},'admin');
  assert.equal(enrollment.schoolId,schoolId);
});
test('rejects duplicate student enrollment for an academic year', async () => {
  const prisma = { student: { findFirst: async () => ({ id: 'student-1', user: {}, enrollments: [{ schoolId }], studentParents: [] }) }, academicYear: { findFirst: async () => ({}) }, schoolClass: { findFirst: async () => ({}) }, section: { findFirst: async () => ({}) }, studentEnrollment: { findUnique: async () => ({ id: 'existing' }) } };
  await assert.rejects(() => new StudentsService(prisma).enroll('student-1', schoolId, { academicYearId: 'year-1', classId: 'class-1', sectionId: 'section-1' }), ConflictException);
});
test('bulk attendance rejects duplicate enrollment IDs', async () => {
  const service = new AttendanceService({});
  await assert.rejects(() => service.markStudents(schoolId, 'user-1', { date: '2026-08-18', records: [{ enrollmentId: 'e1', status: 'PRESENT' }, { enrollmentId: 'e1', status: 'ABSENT' }] }), BadRequestException);
});
test('timetable rejects invalid weekday before creating entries', async () => {
  await assert.rejects(() => new TimetableService({}).createEntry(schoolId, { academicYearId: 'y', classId: 'c', sectionId: 's', subjectId: 'sub', teacherId: 't', periodId: 'p', weekday: 8 }), BadRequestException);
});
test('exam configuration rejects passing marks above maximum marks', async () => {
  const service = new ExamsService({ exam: { findFirst: async () => ({ id: 'exam', academicYearId: 'year' }) } });
  await assert.rejects(() => service.addSubject(schoolId, 'exam', { classId: 'c', subjectId: 's', maximumMarks: 50, passingMarks: 60 }), BadRequestException);
});
test('events reject an end time before the start time', async () => {
  assert.throws(() => new EventsService({}).create(schoolId, { title: 'Event', eventType: 'SCHOOL', startsAt: '2026-09-02', endsAt: '2026-09-01' }), BadRequestException);
});
test('school-scoped operational APIs reject platform users without a school', () => {
  assert.throws(() => new TimetableService({}).list(null), ForbiddenException);
});
