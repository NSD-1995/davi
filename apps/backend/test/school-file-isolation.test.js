const test = require('node:test'), assert = require('node:assert/strict');
const {createHash} = require('node:crypto');
const {SchoolExperienceService} = require('../dist/school-experience/school-experience.service');
const {AdmissionsDocumentsService} = require('../dist/student-admissions/admissions-documents.service');
const bytes = Buffer.from('test image contents');
const actor = {id: 'user-a', schoolId: 'school-a'};
const base = {id: 'asset-a', schoolId: 'school-a', ownerUserId: actor.id, category: 'STAFF_PROFILE_PHOTO', visibility: 'PRIVATE', status: 'ACTIVE', provider: 'local', storageKey: 'opaque.png', sha256: createHash('sha256').update(bytes).digest('hex')};
function media(row = base, branding = {}) {
  const queries = [], reads = [];
  const db = {
    mediaAsset: {findFirst: async ({where}) => {
      queries.push(where);
      if (!row || row.id !== where.id || row.status !== where.status || where.schoolId && where.schoolId !== row.schoolId || where.visibility && where.visibility !== row.visibility || where.category && !where.category.in.includes(row.category)) return null;
      return row;
    }},
    schoolSetting: {findUnique: async () => ({branding})},
    userRole: {findMany: async () => []},
  };
  const service = new SchoolExperienceService(db, {provider: () => ({get: async key => {reads.push(key); return bytes;}})}, {});
  return {service, queries, reads};
}
test('another school cannot read private photos or public branding via authenticated media', async () => {
  for (const row of [base, {...base, visibility: 'PUBLIC', category: 'SCHOOL_LOGO'}]) {
    const {service, queries, reads} = media(row);
    await assert.rejects(service.asset(row.id, {id: 'admin-b', schoolId: 'school-b'}), /unavailable/);
    assert.equal(queries[0].schoolId, 'school-b');
    assert.deepEqual(reads, []);
  }
});
test('actors without school membership cannot query media', async () => {
  const {service, queries, reads} = media();
  await assert.rejects(service.asset(base.id, {id: 'platform-admin'}), /membership/);
  assert.deepEqual(queries, []);
  assert.deepEqual(reads, []);
});
test('anonymous requests cannot retrieve private photos or unpublished branding', async () => {
  for (const row of [base, {...base, category: 'SCHOOL_LOGO', visibility: 'PUBLIC'}, {...base, visibility: 'PUBLIC'}]) {
    const {service, reads} = media(row);
    await assert.rejects(service.asset(row.id), /unavailable/);
    assert.deepEqual(reads, []);
  }
});
test('only the published category-specific branding slot is public', async () => {
  const row = {...base, category: 'SCHOOL_LOGO', visibility: 'PUBLIC'};
  const id = '11111111-1111-4111-8111-111111111111';
  const good = media({...row, id}, {logoId: id});
  assert.deepEqual((await good.service.asset(id)).buffer, bytes);
  const wrongSlot = media({...row, id}, {backgroundId: id});
  await assert.rejects(wrongSlot.service.asset(id), /unavailable/);
  assert.deepEqual(wrongSlot.reads, []);
});
test('same-school photos still enforce owner or staff-view permission', async () => {
  const {service, reads} = media();
  await assert.rejects(service.asset(base.id, {...actor, id: 'another-staff'}), /permission/);
  assert.deepEqual(reads, []);
  assert.deepEqual((await service.asset(base.id, actor)).buffer, bytes);
});
test('admission documents are scoped by both school and application before disk access', async () => {
  const queries = [];
  const service = new AdmissionsDocumentsService({admissionDocument: {findFirst: async ({where}) => {queries.push(where); return null;}}}, {school: school => {if (!school) throw Error('School membership required');}});
  await assert.rejects(service.download('school-b', 'application-a', 'document-a'), /not found/);
  assert.deepEqual(queries, [{id: 'document-a', schoolId: 'school-b', applicationId: 'application-a'}]);
  await assert.rejects(service.download(null, 'application-a', 'document-a'), /membership/);
  assert.equal(queries.length, 1);
});

test('HTTP media and metadata routes require a valid session and reject another school', async () => {
  const {Module} = require('@nestjs/common');
  const {NestFactory} = require('@nestjs/core');
  const {JwtService} = require('@nestjs/jwt');
  const {PrismaService} = require('../dist/prisma/prisma.service');
  const {JwtAuthGuard} = require('../dist/auth/jwt-auth.guard');
  const {SchoolExperienceController} = require('../dist/school-experience/school-experience.controller');
  const {service} = media();
  const jwt = new JwtService({secret: 'test-only-file-isolation'});
  const db = {user: {findUnique: async ({where}) => ['user-a', 'user-b'].includes(where.id) ? {
    id: where.id, schoolId: where.id === 'user-a' ? 'school-a' : 'school-b',
    status: 'ACTIVE', mustChangePassword: false, roles: [],
  } : null}};
  class TestModule {}
  Module({controllers: [SchoolExperienceController], providers: [
    {provide: SchoolExperienceService, useValue: service}, JwtAuthGuard,
    {provide: JwtService, useValue: jwt}, {provide: PrismaService, useValue: db},
  ]})(TestModule);
  const app = await NestFactory.create(TestModule, {logger: false});
  await app.listen(0, '127.0.0.1');
  try {
    const root = await app.getUrl() + '/school-experience';
    const auth = id => ({Authorization: 'Bearer ' + jwt.sign({sub: id})});
    for (const suffix of ['', '/metadata']) {
      assert.equal((await fetch(root + '/media/asset-a' + suffix)).status, 401);
      assert.equal((await fetch(root + '/media/asset-a' + suffix, {headers: auth('user-b')})).status, 404);
      const owner = await fetch(root + '/media/asset-a' + suffix, {headers: auth('user-a')});
      assert.equal(owner.status, 200);
      assert.equal(owner.headers.get('cache-control'), 'private, no-store');
    }
    assert.equal((await fetch(root + '/public-media/asset-a')).status, 404);
    assert.equal((await fetch(root + '/media/asset-a', {headers: {Authorization: 'Bearer invalid'}})).status, 401);
  } finally { await app.close(); }
});
