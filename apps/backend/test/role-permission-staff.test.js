require('reflect-metadata');
const test = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const { ConflictException, ForbiddenException } = require('@nestjs/common');
const { RolesService } = require('../dist/roles/roles.service');
const { StaffService } = require('../dist/staff/staff.service');
const { PermissionsGuard } = require('../dist/auth/permissions.guard');

const schoolId = 'school-1';
const role = { id: 'role-1', schoolId, name: 'Teacher', code: 'TEACHER', isSystem: false, isActive: true, rolePermissions: [] };
const rolePrisma = () => ({ school: { findUnique: async () => ({ id: schoolId }) }, role: { findUnique: async () => null, findFirst: async () => role, findMany: async () => [role], create: async ({ data }) => ({ id: role.id, ...data }), update: async ({ data }) => ({ ...role, ...data }), delete: async () => role }, userRole: { count: async () => 0 }, permission: { count: async ({ where }) => where.id.in.length }, rolePermission: {}, $transaction: async (cb) => cb({ rolePermission: { deleteMany: async () => ({}), createMany: async () => ({}) } }) });

test('creates school role and allows same code in another school', async () => {
  const service = new RolesService(rolePrisma());
  assert.equal((await service.create(schoolId, schoolId, { name: 'Teacher', code: 'teacher' })).code, 'TEACHER');
  assert.equal((await service.create('school-2', 'school-2', { name: 'Teacher', code: 'teacher' })).schoolId, 'school-2');
});
test('rejects duplicate role code and cross-school management', async () => {
  const prisma = rolePrisma(); prisma.role.findUnique = async () => role;
  await assert.rejects(() => new RolesService(prisma).create(schoolId, schoolId, { name: 'Teacher', code: 'TEACHER' }), ConflictException);
  assert.throws(() => new RolesService(prisma).findAll(schoolId, 'school-2'), ForbiddenException);
});
test('updates/lists roles, replaces permissions, and protects SCHOOL_ADMIN deletion', async () => {
  const prisma = rolePrisma(); const service = new RolesService(prisma);
  assert.equal((await service.findAll(schoolId, schoolId)).length, 1);
  assert.equal((await service.update(schoolId, role.id, schoolId, { name: 'Senior Teacher' })).name, 'Senior Teacher');
  await service.replacePermissions(schoolId, role.id, schoolId, { permissionIds: ['permission-1'] });
  prisma.role.findFirst = async () => ({ ...role, code: 'SCHOOL_ADMIN', isSystem: true });
  await assert.rejects(() => service.remove(schoolId, role.id, schoolId), ConflictException);
});

test('creates staff login with hashed temporary password and assigned role', async () => {
  let storedHash; let assignment;
  const prisma = { role: { findFirst: async () => role }, user: { findFirst: async () => null }, staff: { findUnique: async () => null }, $transaction: async (cb) => cb({ user: { create: async ({ data }) => { storedHash = data.passwordHash; return { id: 'user-1', ...data }; } }, staff: { create: async ({ data }) => ({ id: 'staff-1', ...data }), findUniqueOrThrow: async () => ({ id: 'staff-1', userId: 'user-1', user: { passwordHash: storedHash, roles: [{ role }] } }) }, teacher: { create: async () => ({}) }, userRole: { create: async ({ data }) => { assignment = data; } } }) };
  const result = await new StaffService(prisma).create(schoolId, schoolId, { firstName: 'Ravi', mobile: '9876543210', employeeId: 'EMP001', roleId: role.id });
  assert.equal(result.credentials.username, '9876543210'); assert.equal(result.credentials.mustChangePassword, true);
  assert.equal(await bcrypt.compare(result.credentials.temporaryPassword, storedHash), true); assert.equal(assignment.roleId, role.id); assert.equal(result.staff.user.passwordHash, undefined);
});

function context(user, required = ['CLASS_CREATE']) { return { getHandler: () => 'handler', getClass: () => 'class', switchToHttp: () => ({ getRequest: () => ({ user, params: { schoolId } }) }), required }; }
test('permission guard denies missing permission and allows granted permission', async () => {
  const reflector = { getAllAndOverride: (_key, targets) => targets[0].required ?? ['CLASS_CREATE'] };
  const denied = new PermissionsGuard(reflector, { userRole: { findMany: async () => [{ role: { code: 'TEACHER', rolePermissions: [] } }] } });
  const ctx = context({ id: 'user-1', schoolId }); ctx.getHandler = () => ({ required: ['CLASS_CREATE'] });
  await assert.rejects(() => denied.canActivate(ctx), ForbiddenException);
  const allowed = new PermissionsGuard(reflector, { userRole: { findMany: async () => [{ role: { code: 'TEACHER', rolePermissions: [{ permission: { code: 'CLASS_CREATE' } }] } }] } });
  assert.equal(await allowed.canActivate(ctx), true);
});
test('permission guard gives SCHOOL_ADMIN full access', async () => {
  const reflector = { getAllAndOverride: () => ['ROLE_DELETE'] };
  const guard = new PermissionsGuard(reflector, { userRole: { findMany: async () => [{ role: { code: 'SCHOOL_ADMIN', rolePermissions: [] } }] } });
  assert.equal(await guard.canActivate(context({ id: 'admin', schoolId })), true);
});
