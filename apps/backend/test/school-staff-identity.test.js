require('reflect-metadata');
const test = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const { StaffService } = require('../dist/staff/staff.service');
const { AuthService } = require('../dist/auth/auth.service');

test('staff uniqueness is scoped to the destination school', async () => {
  let where;
  const service = new StaffService({ role: { findFirst: async () => ({ id: 'role' }) }, user: { findFirst: async query => { where = query.where; return {}; } } });
  await assert.rejects(service.create('new-school', 'new-school', { firstName: 'A', mobile: '9876543210', email: 'a@test.com', employeeId: 'E1', roleId: 'role' }), /in this school/);
  assert.equal(where.schoolId, 'new-school');
});

test('duplicate active logins require a school selector', async () => {
  const service = new AuthService({ user: { findMany: async () => [{ id: 'one' }, { id: 'two' }] } }, {});
  await assert.rejects(service.login({ username: '9876543210', password: 'test' }), /school login page/);
});

test('school login filters active accounts and validates their password', async () => {
  let where;
  const passwordHash = await bcrypt.hash('test-password', 4);
  const service = new AuthService({ user: { findMany: async query => { where = query.where; return [{ id: 'new-user', email: 'same@test.com', passwordHash, status: 'ACTIVE' }]; } } }, { sign: payload => payload.sub });
  const result = await service.login({ username: '9876543210', password: 'test-password', schoolSlug: 'new-school' });
  assert.equal(where.status, 'ACTIVE');
  assert.deepEqual(where.school, { slug: 'new-school' });
  assert.equal(result.token, 'new-user');
  await assert.rejects(service.login({ username: '9876543210', password: 'wrong', schoolSlug: 'new-school' }), /Invalid username/);
});

test('staff activation and deactivation synchronize teacher status', async () => {
  const statuses = [];
  const staff = { id: 'staff', userId: 'user' };
  const tx = { user: { update: async () => ({}) }, staff: { update: async () => ({}), findUniqueOrThrow: async () => staff }, teacher: { updateMany: async query => statuses.push(query.data.status) } };
  const prisma = { staff: { findFirst: async () => staff }, ...tx, $transaction: async action => typeof action === 'function' ? action(tx) : Promise.all(action) };
  prisma.staff = { ...tx.staff, findFirst: async () => staff };
  const service = new StaffService(prisma);
  await service.update('school', 'staff', 'school', { status: 'ACTIVE' });
  await service.update('school', 'staff', 'school', { status: 'INACTIVE' });
  await service.deactivate('school', 'staff', 'school');
  assert.deepEqual(statuses, ['ACTIVE', 'INACTIVE', 'INACTIVE']);
});
