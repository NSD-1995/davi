require('reflect-metadata');
const test = require('node:test');
const assert = require('node:assert/strict');
const { TimetablePlanningService } = require('../dist/timetable/timetable-planning.service');

function fixture(year = { id: 'year' }) {
  const calls = [];
  const db = {
    academicYear: { findFirst: async args => { calls.push(['year', args]); return year; } },
    timetableEntry: { deleteMany: async args => { calls.push(['entries', args]); return { count: 20 }; } },
    timetablePlan: { deleteMany: async args => { calls.push(['plans', args]); return { count: 3 }; } },
    $transaction: async callback => { calls.push(['transaction']); return callback(db); },
  };
  return { service: new TimetablePlanningService(db, {}), calls };
}

test('deletes all timetable versions atomically within the school and academic year', async () => {
  const { service, calls } = fixture();
  assert.deepEqual(await service.removeAll('school', 'year'), { deletedPlans: 3, deletedEntries: 20 });
  assert.deepEqual(calls, [
    ['year', { where: { id: 'year', schoolId: 'school' }, select: { id: true } }],
    ['transaction'],
    ['entries', { where: { schoolId: 'school', academicYearId: 'year' } }],
    ['plans', { where: { schoolId: 'school', academicYearId: 'year' } }],
  ]);
});

test('rejects a missing school or year before performing any queries', async () => {
  const { service, calls } = fixture();
  await assert.rejects(service.removeAll(null, 'year'), /school account/);
  for (const year of [undefined, '', ' ', ['year']]) {
    await assert.rejects(service.removeAll('school', year), /academicYearId is required/);
  }
  assert.deepEqual(calls, []);
});

test('rejects an unknown or foreign academic year before deleting anything', async () => {
  const { service, calls } = fixture(null);
  await assert.rejects(service.removeAll('school', 'foreign-year'), /Academic year not found/);
  assert.equal(calls.length, 1);
});
