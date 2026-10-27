const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), ts = require('typescript');
function load(fetchImpl) {
  const result = {};
  const source = ts.transpileModule(fs.readFileSync('apps/web/lib/school-metadata.ts', 'utf8'), {compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022}}).outputText;
  new Function('exports', 'require', 'fetch', source)(result, name => {
    if (name === 'react') return {cache: fn => fn};
    if (name === 'next/headers') return {headers: () => new Map([['host', 'school.example']])};
    throw Error(name);
  }, fetchImpl);
  return result;
}
test('school previews keep each school identity, canonical and image separate', () => {
  const {schoolMetadata} = load();
  for (const slug of ['kd', 'second-school']) {
    const metadata = schoolMetadata(new URL('https://school.example'), {name: slug, slug, branding: {iconId: slug + '-icon'}});
    assert.equal(metadata.title, `${slug} | School Login`);
    assert.equal(metadata.openGraph.siteName, slug);
    assert.equal(metadata.alternates.canonical, `https://school.example/school/${slug}/login`);
    assert.equal(metadata.openGraph.images[0].url, `https://school.example/share-image?school=${slug}`);
    assert.equal(metadata.twitter.images[0].url, metadata.openGraph.images[0].url);
    assert.ok(metadata.icons.icon.endsWith(slug + '-icon'));
    assert.equal(metadata.robots.index, false);
  }
});
test('unavailable schools retain their requested URL without borrowing a school identity', () => {
  const metadata = load().schoolMetadata(new URL('https://school.example'), null, 'missing');
  assert.equal(metadata.title, 'School Portal | School Login');
  assert.equal(metadata.openGraph.siteName, 'School Portal');
  assert.equal(metadata.openGraph.images[0].url, 'https://school.example/share-image?school=missing');
});
test('public identity lookup encodes the slug and handles backend failures', async () => {
  const calls = [];
  const api = load(async (url, options) => {calls.push({url, options}); return {ok: true, json: async () => ({name: 'A School', slug: 'a'})};});
  assert.equal((await api.getPublicSchoolIdentity('a/b')).name, 'A School');
  assert.ok(calls[0].url.endsWith('/public/a%2Fb'));
  assert.equal(calls[0].options.cache, 'no-store');
  assert.equal(await load(async () => {throw Error('offline');}).getPublicSchoolIdentity('a'), null);
  assert.equal(await load(async () => ({ok: false})).getPublicSchoolIdentity('a'), null);
});
test('default metadata references the generated 1200 by 630 PNG', () => {
  const metadata = load().schoolMetadata(new URL('https://school.example'));
  assert.equal(metadata.openGraph.images[0].url, 'https://school.example/images/school-share.png');
  const png = fs.readFileSync('apps/web/public/images/school-share.png');
  assert.equal(png.readUInt32BE(16), 1200);
  assert.equal(png.readUInt32BE(20), 630);
});
