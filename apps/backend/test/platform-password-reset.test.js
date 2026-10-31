require('reflect-metadata');
const test = require('node:test');
const assert = require('node:assert/strict');
const { PlatformService } = require('../dist/platform/platform.service');

test('platform password recovery stores a hash, invalidates prior links, and expires in thirty minutes', async () => {
  let invalidated; let created;
  const prisma = {
    user: { findUnique: async () => ({ id: 'user', schoolId: null, status: 'ACTIVE', roles: [{ role: { code: 'SUPER_ADMIN' } }] }) },
    $transaction: async action => action({ platformPasswordReset: { updateMany: async query => { invalidated = query; }, create: async query => { created = query; } } }),
  };
  const result = await new PlatformService(prisma).createPasswordReset('actor', 'user');
  assert.equal(result.token.length > 20, true);
  assert.notEqual(created.data.tokenHash, result.token);
  assert.equal(invalidated.where.userId, 'user');
  assert.equal(invalidated.data.usedAt instanceof Date, true);
  assert.equal(Math.round((new Date(result.expiresAt).getTime() - Date.now()) / 60000), 30);
});
