const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), ts = require('typescript');
const brand = {}, manifest = {};
function compile(path, target, requires = require) {
  new Function('exports', 'require', ts.transpileModule(fs.readFileSync(path, 'utf8'), {compilerOptions: {module: ts.ModuleKind.CommonJS}}).outputText)(target, requires);
}
compile('apps/web/lib/school-brand.ts', brand);
compile('apps/web/lib/school-manifest.ts', manifest, name => name === './school-brand' ? brand : require(name));
test('installed school apps have distinct identities, launch paths and icons', () => {
  for (const slug of ['kd', 'other']) {
    const app = manifest.schoolManifest({name: 'School ' + slug, shortName: 'XX', slug, branding: {primary: '#411616'}});
    assert.equal(app.name, `School ${slug} School Workspace`);
    assert.equal(app.short_name, `School ${slug} Workspace`);
    assert.equal(app.id, `/school/${slug}/`);
    assert.equal(app.scope, `/school/${slug}/`);
    assert.equal(app.start_url, `/school/${slug}/login`);
    assert.equal(app.theme_color, '#411616');
    assert.deepEqual(app.icons.map(icon => icon.sizes), ['192x192', '512x512']);
    for (const icon of app.icons) assert.ok(icon.src.startsWith(app.scope));
  }
});
test('manifest rejects invalid theme colors and encodes school paths', () => {
  const app = manifest.schoolManifest({name: 'A', slug: 'a/b', branding: {primary: 'red;bad'}});
  assert.equal(app.id, '/school/a%2Fb/');
  assert.equal(app.theme_color, '#123f52');
});
